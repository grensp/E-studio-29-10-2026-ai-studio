use crate::commands::DbState;
use rusqlite::OptionalExtension;
use serde::Serialize;
use serde_json::{json, Value};
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::net::{IpAddr, Ipv6Addr, SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tauri::State;

const MAX_PDF_BYTES: usize = 64 * 1024 * 1024;
const MAX_ZPL_BYTES: usize = 16 * 1024 * 1024;
const CONNECT_TIMEOUT: Duration = Duration::from_secs(3);
const WRITE_TIMEOUT: Duration = Duration::from_secs(10);
static SPOOL_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Serialize)]
pub struct PrintCapabilities {
    platform: &'static str,
    cups_supported: bool,
    raw_zpl_tcp_supported: bool,
    note: &'static str,
}

#[derive(Debug, Serialize)]
pub struct PrintQueue {
    name: String,
    state: String,
    is_default: bool,
}

#[tauri::command]
pub fn print_capabilities() -> PrintCapabilities {
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    {
        PrintCapabilities {
            platform: std::env::consts::OS,
            cups_supported: true,
            raw_zpl_tcp_supported: true,
            note: "CUPS PDF queues and configured private-network ZPL/9100-style raw TCP targets are supported. Device-level physical completion is not guaranteed.",
        }
    }
    #[cfg(target_os = "windows")]
    {
        PrintCapabilities {
            platform: "windows",
            cups_supported: false,
            raw_zpl_tcp_supported: true,
            note: "Only configured private-network ZPL raw TCP is supported. Windows spooler/PDF queue submission is not implemented.",
        }
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        PrintCapabilities {
            platform: std::env::consts::OS,
            cups_supported: false,
            raw_zpl_tcp_supported: false,
            note: "This operating system has no supported native print adapter.",
        }
    }
}

#[tauri::command]
pub fn print_list_queues() -> Result<Vec<PrintQueue>, String> {
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    {
        let output = run_command(Command::new("lpstat").arg("-p"))?;
        if !output.status.success() {
            return Err(command_error("Could not list CUPS printer queues", &output));
        }

        let default_output = run_command(Command::new("lpstat").arg("-d"))?;
        let default_text = String::from_utf8_lossy(&default_output.stdout);
        let default_queue = default_text
            .split_once(':')
            .map(|(_, value)| value.trim())
            .unwrap_or_default();

        let text = String::from_utf8_lossy(&output.stdout);
        let queues = text
            .lines()
            .filter_map(|line| {
                let mut parts = line.split_whitespace();
                if parts.next()? != "printer" {
                    return None;
                }
                let name = parts.next()?.to_string();
                let state = line
                    .strip_prefix(&format!("printer {name} "))
                    .map(|state| {
                        state
                            .strip_prefix("is ")
                            .unwrap_or(state)
                            .split('.')
                            .next()
                            .unwrap_or(state)
                            .to_string()
                    })
                    .unwrap_or_else(|| "unknown".to_string());
                Some(PrintQueue {
                    is_default: name == default_queue,
                    name,
                    state,
                })
            })
            .collect();
        Ok(queues)
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    {
        Err("CUPS queue discovery is unsupported on this operating system.".to_string())
    }
}

#[tauri::command]
pub fn print_submit_pdf(
    state: State<'_, DbState>,
    mut job: Value,
    queue: String,
    pdf_bytes: Vec<u8>,
) -> Result<Value, String> {
    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    {
        let _ = (state, job, queue, pdf_bytes);
        return Err(
            "PDF printer submission is supported only through CUPS on Linux and macOS.".to_string(),
        );
    }
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    {
        validate_job(&job)?;
        validate_pdf(&pdf_bytes)?;
        validate_queue(&queue)?;
        ensure_job_id_unused(&state, job_id(&job)?)?;
        let spool_path = save_spool_file(&state, job_id(&job)?, "pdf", &pdf_bytes)?;
        set_job_fields(
            &mut job,
            "submitting",
            &queue,
            "cups",
            Some(spool_path.to_string_lossy().as_ref()),
            None,
            None,
            false,
        );
        if let Err(error) = insert_new_job(&state, &job) {
            let _ = fs::remove_file(&spool_path);
            return Err(error);
        }

        let title = safe_job_title(&job);
        let output = run_command(
            Command::new("lp")
                .arg("-d")
                .arg(&queue)
                .arg("-t")
                .arg(title)
                .arg(&spool_path),
        );
        match output {
            Ok(output) if output.status.success() => {
                let native_id = parse_cups_job_id(&output);
                set_job_fields(
                    &mut job,
                    "queued",
                    &queue,
                    "cups",
                    Some(spool_path.to_string_lossy().as_ref()),
                    native_id.as_deref(),
                    None,
                    false,
                );
                job["status_detail"] = json!(if native_id.is_some() {
                    "CUPS accepted the job into its queue; physical completion is not confirmed."
                } else {
                    "CUPS accepted the submission, but no native job ID was returned for tracking."
                });
                persist_job(&state, &job).map_err(|error| {
                    format!("CUPS accepted the job, but the final job state could not be saved. Check the CUPS queue before retrying: {error}")
                })?;
                Ok(job)
            }
            Ok(output) => {
                let error = command_error("CUPS rejected the PDF print job", &output);
                set_job_fields(
                    &mut job,
                    "unknown",
                    &queue,
                    "cups",
                    Some(spool_path.to_string_lossy().as_ref()),
                    None,
                    Some(&error),
                    false,
                );
                job["status_detail"] = json!("The CUPS command returned an error. Confirm the queue did not accept this job before submitting another copy.");
                persist_job(&state, &job)?;
                Err(error)
            }
            Err(error) => {
                set_job_fields(
                    &mut job,
                    "failed",
                    &queue,
                    "cups",
                    Some(spool_path.to_string_lossy().as_ref()),
                    None,
                    Some(&error),
                    true,
                );
                persist_job(&state, &job)?;
                Err(error)
            }
        }
    }
}

#[tauri::command]
pub fn print_submit_zpl(
    state: State<'_, DbState>,
    mut job: Value,
    host: String,
    port: u16,
    zpl_content: String,
) -> Result<Value, String> {
    validate_job(&job)?;
    validate_zpl(zpl_content.as_bytes())?;
    let address = validate_private_printer_address(&host, port)?;
    ensure_job_id_unused(&state, job_id(&job)?)?;
    let spool_path = save_spool_file(&state, job_id(&job)?, "zpl", zpl_content.as_bytes())?;
    let target = format!("{address}");
    set_job_fields(
        &mut job,
        "submitting",
        &target,
        "raw_zpl_tcp",
        Some(spool_path.to_string_lossy().as_ref()),
        None,
        None,
        false,
    );
    job["target_host"] = json!(host);
    job["target_port"] = json!(port);
    job["device_completion_confirmed"] = Value::Bool(false);
    if let Err(error) = insert_new_job(&state, &job) {
        let _ = fs::remove_file(&spool_path);
        return Err(error);
    }

    match send_zpl(address, zpl_content.as_bytes()) {
        Ok(()) => {
            set_job_fields(
                &mut job,
                "submitted_unconfirmed",
                &target,
                "raw_zpl_tcp",
                Some(spool_path.to_string_lossy().as_ref()),
                None,
                None,
                false,
            );
            job["status_detail"] = json!("Bytes written to the printer socket. The device and physical print completion cannot be confirmed over raw TCP.");
            persist_job(&state, &job).map_err(|error| {
                format!("ZPL bytes were sent, but the final job state could not be saved. Check the printer before retrying: {error}")
            })?;
            Ok(job)
        }
        Err(failure) => {
            set_job_fields(
                &mut job,
                if failure.delivery_may_have_started {
                    "unknown"
                } else {
                    "failed"
                },
                &target,
                "raw_zpl_tcp",
                Some(spool_path.to_string_lossy().as_ref()),
                None,
                Some(&failure.message),
                !failure.delivery_may_have_started,
            );
            persist_job(&state, &job)?;
            Err(failure.message)
        }
    }
}

#[tauri::command]
pub fn print_refresh_job(state: State<'_, DbState>, id: String) -> Result<Value, String> {
    let mut job = load_job(&state, &id)?;
    if job["target_kind"] != "cups" || job["native_job_id"].as_str().is_none() {
        return Ok(job);
    }

    let queue = job["target"]
        .as_str()
        .ok_or_else(|| "Stored CUPS queue is missing.".to_string())?
        .to_string();
    validate_queue(&queue)?;
    let native_id = job["native_job_id"]
        .as_str()
        .ok_or_else(|| "Stored CUPS job ID is missing.".to_string())?;
    let pending = run_command(
        Command::new("lpstat")
            .arg("-W")
            .arg("not-completed")
            .arg("-o")
            .arg(&queue),
    )?;
    if !pending.status.success() {
        return Err(command_error("Could not query the CUPS queue", &pending));
    }
    let pending_text = String::from_utf8_lossy(&pending.stdout);
    if pending_text
        .lines()
        .any(|line| line.split_whitespace().next() == Some(native_id))
    {
        job["status"] = json!("queued");
        job["status_detail"] = json!("CUPS reports the job as not completed; this is spooler status, not proof of physical output.");
        persist_job(&state, &job)?;
        return Ok(job);
    }

    let completed = run_command(
        Command::new("lpstat")
            .arg("-W")
            .arg("completed")
            .arg("-o")
            .arg(&queue),
    )?;
    if !completed.status.success() {
        return Err(command_error(
            "Could not query completed CUPS jobs",
            &completed,
        ));
    }
    let completed_text = String::from_utf8_lossy(&completed.stdout);
    if completed_text
        .lines()
        .any(|line| line.split_whitespace().next() == Some(native_id))
    {
        job["status"] = json!("spooler_completed");
        job["status_detail"] = json!("CUPS reports completion by the spooler. Physical output and finishing are not independently verified.");
    } else {
        job["status"] = json!("unknown");
        job["status_detail"] = json!("The job is not present in the CUPS active or completed history. It may have expired from spooler history.");
    }
    persist_job(&state, &job)?;
    Ok(job)
}

#[tauri::command]
pub fn print_retry_job(state: State<'_, DbState>, id: String) -> Result<Value, String> {
    let mut job = load_job(&state, &id)?;
    if job["status"] != "failed" || job["retry_allowed"] != true {
        return Err("This print job is not in a safely retryable state.".to_string());
    }
    let spool_path = existing_spool_path(&state, &job)?;
    let bytes =
        fs::read(&spool_path).map_err(|e| format!("Could not read saved print artifact: {e}"))?;

    match job["target_kind"].as_str() {
        Some("cups") => {
            #[cfg(any(target_os = "linux", target_os = "macos"))]
            {
                let queue = job["target"]
                    .as_str()
                    .ok_or_else(|| "Stored CUPS queue is missing.".to_string())?
                    .to_string();
                validate_queue(&queue)?;
                validate_pdf(&bytes)?;
                job = claim_retry_job(&state, &id)?;
                let output = match run_command(
                    Command::new("lp")
                        .arg("-d")
                        .arg(queue)
                        .arg("-t")
                        .arg(safe_job_title(&job))
                        .arg(&spool_path),
                ) {
                    Ok(output) => output,
                    Err(error) => {
                        job["status"] = json!("failed");
                        job["error"] = json!(error);
                        job["retry_allowed"] = Value::Bool(true);
                        job["status_detail"] = json!(
                            "The CUPS command could not start, so the retry was not submitted."
                        );
                        persist_job(&state, &job)?;
                        return Err(error);
                    }
                };
                if !output.status.success() {
                    let error = command_error("CUPS rejected the retry", &output);
                    job["status"] = json!("unknown");
                    job["error"] = json!(error);
                    job["retry_allowed"] = Value::Bool(false);
                    job["status_detail"] = json!("The CUPS command returned an error during retry. Confirm the queue did not accept this copy before sending again.");
                    persist_job(&state, &job)?;
                    return Err(error);
                }
                job["status"] = json!("queued");
                job["error"] = Value::Null;
                job["retry_allowed"] = Value::Bool(false);
                job["native_job_id"] = json!(parse_cups_job_id(&output));
                job["status_detail"] =
                    json!("CUPS accepted the retry; physical completion is not confirmed.");
                persist_job(&state, &job).map_err(|error| {
                    format!("CUPS accepted the retry, but its final state could not be saved. Check the queue before retrying again: {error}")
                })?;
                Ok(job)
            }
            #[cfg(not(any(target_os = "linux", target_os = "macos")))]
            {
                Err("CUPS retries are unsupported on this operating system.".to_string())
            }
        }
        Some("raw_zpl_tcp") => {
            let host = job["target_host"]
                .as_str()
                .ok_or_else(|| "Stored printer address is missing.".to_string())?;
            let port = job["target_port"]
                .as_u64()
                .and_then(|value| u16::try_from(value).ok())
                .ok_or_else(|| "Stored printer port is invalid.".to_string())?;
            let address = validate_private_printer_address(host, port)?;
            let zpl = String::from_utf8(bytes)
                .map_err(|_| "Saved ZPL artifact is not valid UTF-8.".to_string())?;
            validate_zpl(zpl.as_bytes())?;
            job = claim_retry_job(&state, &id)?;
            match send_zpl(address, zpl.as_bytes()) {
                Ok(()) => {
                    job["status"] = json!("submitted_unconfirmed");
                    job["error"] = Value::Null;
                    job["status_detail"] = json!("Bytes written to the printer socket. Physical print completion is unconfirmed.");
                    job["retry_allowed"] = Value::Bool(false);
                    persist_job(&state, &job).map_err(|error| {
                        format!("ZPL bytes were resent, but the retry state could not be saved. Check the printer before sending again: {error}")
                    })?;
                    Ok(job)
                }
                Err(failure) => {
                    job["status"] = json!(if failure.delivery_may_have_started {
                        "unknown"
                    } else {
                        "failed"
                    });
                    job["error"] = json!(failure.message);
                    job["retry_allowed"] = json!(!failure.delivery_may_have_started);
                    persist_job(&state, &job)?;
                    Err(failure.message)
                }
            }
        }
        _ => Err("Stored job has no supported printer target and cannot be retried.".to_string()),
    }
}

#[derive(Debug)]
struct SendFailure {
    message: String,
    delivery_may_have_started: bool,
}

fn send_zpl(address: SocketAddr, bytes: &[u8]) -> Result<(), SendFailure> {
    let mut stream =
        TcpStream::connect_timeout(&address, CONNECT_TIMEOUT).map_err(|error| SendFailure {
            message: format!("Could not connect to configured printer {address}: {error}"),
            delivery_may_have_started: false,
        })?;
    stream
        .set_write_timeout(Some(WRITE_TIMEOUT))
        .map_err(|error| SendFailure {
            message: format!("Could not set the printer socket timeout: {error}"),
            delivery_may_have_started: false,
        })?;
    stream.write_all(bytes).map_err(|error| SendFailure {
        message: format!("ZPL delivery failed after the socket was opened; output may be partial and must not be retried automatically: {error}"),
        delivery_may_have_started: true,
    })?;
    stream.shutdown(std::net::Shutdown::Write).map_err(|error| SendFailure {
        message: format!("ZPL bytes were written but socket shutdown failed; physical delivery is uncertain: {error}"),
        delivery_may_have_started: true,
    })?;
    Ok(())
}

fn validate_private_printer_address(host: &str, port: u16) -> Result<SocketAddr, String> {
    if port == 0 {
        return Err("Printer TCP port must be between 1 and 65535.".to_string());
    }
    let ip: IpAddr = host.trim().parse().map_err(|_| {
        "Enter a numeric private-network printer IP address; hostnames are not accepted."
            .to_string()
    })?;
    let local_or_private = match ip {
        IpAddr::V4(ip) => ip.is_private() || ip.is_loopback() || ip.is_link_local(),
        IpAddr::V6(ip) => is_allowed_ipv6(&ip),
    };
    if !local_or_private {
        return Err("Raw ZPL submission is limited to private, loopback, or link-local printer IP addresses.".to_string());
    }
    Ok(SocketAddr::new(ip, port))
}

fn is_allowed_ipv6(ip: &Ipv6Addr) -> bool {
    ip.is_loopback() || ip.is_unique_local() || ip.is_unicast_link_local()
}

fn validate_pdf(bytes: &[u8]) -> Result<(), String> {
    if bytes.len() < 8 || bytes.len() > MAX_PDF_BYTES || !bytes.starts_with(b"%PDF-") {
        return Err("PDF is invalid or exceeds the 64 MiB print limit.".to_string());
    }
    let eof_position = bytes
        .windows(5)
        .rposition(|window| window == b"%%EOF")
        .ok_or_else(|| "PDF has no end-of-file marker and was not submitted.".to_string())?;
    if !bytes[eof_position + 5..]
        .iter()
        .all(u8::is_ascii_whitespace)
    {
        return Err("PDF contains non-whitespace data after its end-of-file marker.".to_string());
    }
    let startxref_position = bytes[..eof_position]
        .windows(9)
        .rposition(|window| window == b"startxref")
        .ok_or_else(|| "PDF has no cross-reference pointer and was not submitted.".to_string())?;
    let offset_text = std::str::from_utf8(&bytes[startxref_position + 9..eof_position])
        .map_err(|_| "PDF cross-reference pointer is malformed.".to_string())?;
    let offset_text = offset_text.trim();
    let offset_digits = offset_text
        .split_whitespace()
        .next()
        .ok_or_else(|| "PDF cross-reference pointer is missing.".to_string())?;
    let xref_offset = offset_digits
        .parse::<usize>()
        .map_err(|_| "PDF cross-reference pointer is malformed.".to_string())?;
    if xref_offset >= eof_position {
        return Err("PDF cross-reference pointer is outside the document.".to_string());
    }
    let xref_section = &bytes[xref_offset..eof_position];
    let classic_xref = xref_section.starts_with(b"xref");
    let stream_xref = !classic_xref
        && xref_section
            .windows(6)
            .position(|window| window == b"stream")
            .map(|stream_position| {
                xref_section[..stream_position]
                    .windows(11)
                    .any(|window| window == b"/Type /XRef")
            })
            .unwrap_or(false);
    if !classic_xref && !stream_xref {
        return Err(
            "PDF cross-reference pointer does not reference an xref table or stream.".to_string(),
        );
    }
    if !bytes.windows(14).any(|window| window == b"/Type /Catalog")
        || !bytes.windows(5).any(|window| window == b"/Root")
    {
        return Err("PDF catalog or document root is missing.".to_string());
    }
    Ok(())
}

fn validate_zpl(bytes: &[u8]) -> Result<(), String> {
    if bytes.is_empty() || bytes.len() > MAX_ZPL_BYTES {
        return Err("ZPL is empty or exceeds the 16 MiB print limit.".to_string());
    }
    let text = std::str::from_utf8(bytes).map_err(|_| "ZPL must be valid UTF-8.".to_string())?;
    let mut in_format = false;
    let mut format_count = 0usize;
    let mut cursor = 0usize;
    while cursor < text.len() {
        let next_start = text[cursor..].find("^XA").map(|offset| (offset, true));
        let next_end = text[cursor..].find("^XZ").map(|offset| (offset, false));
        let next = match (next_start, next_end) {
            (Some(start), Some(end)) if start.0 < end.0 => start,
            (Some(_), Some(end)) => end,
            (Some(start), None) => start,
            (None, Some(end)) => end,
            (None, None) => break,
        };
        cursor += next.0 + 3;
        if next.1 {
            if in_format {
                return Err(
                    "ZPL contains a nested ^XA before the previous format ended.".to_string(),
                );
            }
            in_format = true;
            format_count += 1;
        } else if !in_format {
            return Err("ZPL contains ^XZ without a preceding ^XA.".to_string());
        } else {
            in_format = false;
        }
    }
    if format_count == 0 || in_format {
        return Err("ZPL must contain complete ^XA/^XZ format boundaries.".to_string());
    }
    Ok(())
}

fn validate_queue(queue: &str) -> Result<(), String> {
    if queue.trim().is_empty()
        || queue.len() > 127
        || queue.starts_with('-')
        || !queue
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.'))
    {
        return Err("Select a valid CUPS queue name.".to_string());
    }
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    {
        let output = run_command(Command::new("lpstat").arg("-p").arg(queue))?;
        if !output.status.success() {
            return Err(command_error(
                "Configured CUPS queue is unavailable",
                &output,
            ));
        }
        let queue_output = String::from_utf8_lossy(&output.stdout);
        if queue_output
            .lines()
            .any(|line| line.starts_with(&format!("printer {queue} ")) && line.contains("disabled"))
        {
            return Err(format!("CUPS queue '{queue}' is disabled; enable it in the operating-system printer settings."));
        }
    }
    Ok(())
}

fn validate_job(job: &Value) -> Result<(), String> {
    let id = job
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| "A print job ID is required.".to_string())?;
    validate_job_id(id)
}

fn job_id(job: &Value) -> Result<&str, String> {
    job.get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| "A print job ID is required.".to_string())
}

fn validate_job_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || id.len() > 100
        || id == "."
        || id == ".."
        || !id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err("Print job ID contains unsupported characters.".to_string());
    }
    Ok(())
}

fn save_spool_file(
    state: &State<'_, DbState>,
    id: &str,
    extension: &str,
    bytes: &[u8],
) -> Result<PathBuf, String> {
    validate_job_id(id)?;
    let root = state
        .1
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join("print-spool");
    fs::create_dir_all(&root)
        .map_err(|e| format!("Could not create print spool directory: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&root, fs::Permissions::from_mode(0o700))
            .map_err(|e| format!("Could not restrict print spool directory permissions: {e}"))?;
    }
    for _ in 0..8 {
        let counter = SPOOL_COUNTER.fetch_add(1, Ordering::Relaxed);
        let path = root.join(format!("{id}-{counter}.{extension}"));
        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        match options.open(&path) {
            Ok(mut file) => {
                if let Err(error) = file.write_all(bytes).and_then(|()| file.sync_all()) {
                    drop(file);
                    let cleanup = fs::remove_file(&path);
                    return Err(match cleanup {
                        Ok(()) => format!("Could not persist print artifact for tracking/retry: {error}"),
                        Err(cleanup_error) => format!("Could not persist print artifact ({error}) and could not remove the partial spool file ({cleanup_error})."),
                    });
                }
                return Ok(path);
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => {
                return Err(format!(
                    "Could not create print artifact for tracking/retry: {error}"
                ))
            }
        }
    }
    Err("Could not allocate a unique path in the print spool directory.".to_string())
}

fn existing_spool_path(state: &State<'_, DbState>, job: &Value) -> Result<PathBuf, String> {
    let id = job_id(job)?;
    validate_job_id(id)?;
    let extension = match job["format"].as_str() {
        Some("pdf") if job["target_kind"] == "cups" => "pdf",
        Some("zpl") if job["target_kind"] == "raw_zpl_tcp" => "zpl",
        _ => return Err("Stored job format does not match a supported retry adapter.".to_string()),
    };
    let candidate = job["spool_path"]
        .as_str()
        .map(PathBuf::from)
        .ok_or_else(|| "The saved print artifact is unavailable for retry.".to_string())?;
    let root = state
        .1
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join("print-spool")
        .canonicalize()
        .map_err(|e| format!("Print spool directory is unavailable: {e}"))?;
    let path = candidate
        .canonicalize()
        .map_err(|e| format!("Saved print artifact is unavailable: {e}"))?;
    if !path.starts_with(&root) || !path.is_file() {
        return Err(
            "Saved artifact path is outside the application print spool directory.".to_string(),
        );
    }
    let max_size = if extension == "pdf" {
        MAX_PDF_BYTES
    } else {
        MAX_ZPL_BYTES
    };
    let artifact_size = path
        .metadata()
        .map_err(|e| format!("Could not inspect saved print artifact: {e}"))?
        .len();
    if artifact_size > max_size as u64 {
        return Err("Saved print artifact exceeds the supported retry size limit.".to_string());
    }
    let expected_prefix = format!("{id}-");
    let filename = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default();
    if !filename.starts_with(&expected_prefix)
        || path.extension().and_then(|ext| ext.to_str()) != Some(extension)
    {
        return Err("Saved print artifact does not match the job identity or format.".to_string());
    }
    Ok(path)
}

#[allow(clippy::too_many_arguments)]
fn set_job_fields(
    job: &mut Value,
    status: &str,
    target: &str,
    target_kind: &str,
    spool_path: Option<&str>,
    native_job_id: Option<&str>,
    error: Option<&str>,
    retry_allowed: bool,
) {
    job["status"] = json!(status);
    job["target"] = json!(target);
    job["target_kind"] = json!(target_kind);
    job["spool_path"] = json!(spool_path);
    job["native_job_id"] = json!(native_job_id);
    job["error"] = json!(error);
    job["retry_allowed"] = json!(retry_allowed);
    if job["attempts"].as_u64().is_none() {
        job["attempts"] = json!(1);
    }
}

fn persist_job(state: &State<'_, DbState>, job: &Value) -> Result<(), String> {
    let id = job_id(job)?;
    let serialized = serde_json::to_string(job).map_err(|e| e.to_string())?;
    let created_at = job["created_at"].as_str().unwrap_or("unknown");
    let connection = state.0.lock().map_err(|e| e.to_string())?;
    connection
        .execute(
            "INSERT INTO print_jobs (id, job_json, created_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(id) DO UPDATE SET job_json = excluded.job_json",
            rusqlite::params![id, serialized, created_at],
        )
        .map_err(|e| format!("Could not persist print job state: {e}"))?;
    Ok(())
}

fn insert_new_job(state: &State<'_, DbState>, job: &Value) -> Result<(), String> {
    let id = job_id(job)?;
    let serialized = serde_json::to_string(job).map_err(|e| e.to_string())?;
    let created_at = job["created_at"].as_str().unwrap_or("unknown");
    let connection = state.0.lock().map_err(|e| e.to_string())?;
    let inserted = connection
        .execute(
            "INSERT INTO print_jobs (id, job_json, created_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(id) DO NOTHING",
            rusqlite::params![id, serialized, created_at],
        )
        .map_err(|e| format!("Could not reserve print job ID: {e}"))?;
    if inserted == 0 {
        return Err(format!(
            "Print job ID '{id}' already exists; generate a new unique ID."
        ));
    }
    Ok(())
}

fn load_job(state: &State<'_, DbState>, id: &str) -> Result<Value, String> {
    let connection = state.0.lock().map_err(|e| e.to_string())?;
    let serialized: Option<String> = connection
        .query_row(
            "SELECT job_json FROM print_jobs WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    serialized
        .ok_or_else(|| format!("Print job '{id}' was not found."))
        .and_then(|json| serde_json::from_str(&json).map_err(|e| e.to_string()))
}

fn ensure_job_id_unused(state: &State<'_, DbState>, id: &str) -> Result<(), String> {
    let connection = state.0.lock().map_err(|e| e.to_string())?;
    let exists: bool = connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM print_jobs WHERE id = ?1)",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if exists {
        return Err(format!(
            "Print job ID '{id}' already exists; generate a new unique ID."
        ));
    }
    Ok(())
}

fn claim_retry_job(state: &State<'_, DbState>, id: &str) -> Result<Value, String> {
    validate_job_id(id)?;
    let mut connection = state.0.lock().map_err(|e| e.to_string())?;
    let transaction = connection.transaction().map_err(|e| e.to_string())?;
    let serialized: Option<String> = transaction
        .query_row(
            "SELECT job_json FROM print_jobs WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let serialized = serialized.ok_or_else(|| format!("Print job '{id}' was not found."))?;
    let mut job: Value = serde_json::from_str(&serialized).map_err(|e| e.to_string())?;
    if job["status"] != "failed" || job["retry_allowed"] != true {
        return Err("This print job is not in a safely retryable state.".to_string());
    }

    job["status"] = json!("submitting");
    job["error"] = Value::Null;
    job["retry_allowed"] = Value::Bool(false);
    job["attempts"] = json!(job["attempts"].as_u64().unwrap_or(1) + 1);
    job["status_detail"] =
        json!("A retry has been reserved and is being submitted to the configured adapter.");
    let serialized = serde_json::to_string(&job).map_err(|e| e.to_string())?;
    let updated = transaction
        .execute(
            "UPDATE print_jobs SET job_json = ?2 WHERE id = ?1",
            rusqlite::params![id, serialized],
        )
        .map_err(|e| format!("Could not reserve print retry: {e}"))?;
    if updated != 1 {
        return Err("The print retry could not be reserved.".to_string());
    }
    transaction.commit().map_err(|e| e.to_string())?;
    Ok(job)
}

fn run_command(command: &mut Command) -> Result<Output, String> {
    command.output().map_err(|error| {
        format!(
            "Could not run {}: {error}",
            command.get_program().to_string_lossy()
        )
    })
}

fn command_error(prefix: &str, output: &Output) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let detail = if !stderr.is_empty() { stderr } else { stdout };
    if detail.is_empty() {
        format!("{prefix} (exit status {}).", output.status)
    } else {
        format!("{prefix}: {detail}")
    }
}

fn parse_cups_job_id(output: &Output) -> Option<String> {
    let text = String::from_utf8_lossy(&output.stdout);
    text.split_whitespace()
        .find(|part| {
            part.rsplit_once('-')
                .is_some_and(|(_, suffix)| suffix.chars().all(|c| c.is_ascii_digit()))
        })
        .map(str::to_string)
}

fn safe_job_title(job: &Value) -> String {
    let id = job["id"].as_str().unwrap_or("E-Studio");
    format!("E-Studio-{}", id.chars().take(70).collect::<String>())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;
    use std::net::TcpListener;
    use std::thread;

    fn minimal_pdf() -> Vec<u8> {
        let mut pdf = b"%PDF-1.4\n".to_vec();
        let catalog_offset = pdf.len();
        pdf.extend_from_slice(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
        let pages_offset = pdf.len();
        pdf.extend_from_slice(b"2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n");
        let xref_offset = pdf.len();
        pdf.extend_from_slice(b"xref\n0 3\n");
        pdf.extend_from_slice(b"0000000000 65535 f \n");
        pdf.extend_from_slice(format!("{catalog_offset:010} 00000 n \n").as_bytes());
        pdf.extend_from_slice(format!("{pages_offset:010} 00000 n \n").as_bytes());
        pdf.extend_from_slice(b"trailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n");
        pdf.extend_from_slice(xref_offset.to_string().as_bytes());
        pdf.extend_from_slice(b"\n%%EOF\n");
        pdf
    }

    #[test]
    fn accepts_private_printer_addresses_and_rejects_public_targets() {
        assert!(validate_private_printer_address("192.168.1.20", 9100).is_ok());
        assert!(validate_private_printer_address("10.0.0.4", 9100).is_ok());
        assert!(validate_private_printer_address("127.0.0.1", 9100).is_ok());
        assert!(validate_private_printer_address("8.8.8.8", 9100).is_err());
        assert!(validate_private_printer_address("printer.local", 9100).is_err());
        assert!(validate_private_printer_address("192.168.1.20", 0).is_err());
    }

    #[test]
    fn validates_pdf_signature_and_end_marker() {
        assert!(validate_pdf(&minimal_pdf()).is_ok());
        assert!(validate_pdf(b"not a pdf %%EOF").is_err());
        assert!(validate_pdf(b"%PDF-1.7\n%%EOF").is_err());
        let mut broken_xref = minimal_pdf();
        let xref_position = broken_xref
            .windows(4)
            .position(|window| window == b"xref")
            .expect("locate cross-reference table");
        let pointer_position = broken_xref
            .windows(9)
            .rposition(|window| window == b"startxref")
            .expect("locate cross-reference pointer")
            + 9;
        let pointer_end = broken_xref[pointer_position..]
            .iter()
            .position(|byte| !byte.is_ascii_whitespace() && !byte.is_ascii_digit())
            .map(|offset| pointer_position + offset)
            .expect("locate pointer terminator");
        let pointer_text =
            std::str::from_utf8(&broken_xref[pointer_position..pointer_end]).expect("read pointer");
        let incorrect_pointer = (xref_position + 1).to_string();
        assert!(pointer_text.trim().parse::<usize>().is_ok());
        broken_xref.splice(pointer_position..pointer_end, incorrect_pointer.bytes());
        assert!(validate_pdf(&broken_xref).is_err());
    }

    #[test]
    fn validates_zpl_format_boundaries() {
        assert!(validate_zpl(b"^XA^FO0,0^FDTest^FS^XZ\n^XA^XZ").is_ok());
        assert!(validate_zpl(b"^FO0,0^FDNo envelope^FS").is_err());
        assert!(validate_zpl(b"^XA without end").is_err());
        assert!(validate_zpl(b"^XZ^XA^XZ").is_err());
        assert!(validate_zpl(b"^XA^XA^XZ").is_err());
    }

    #[test]
    fn rejects_unsafe_job_identifiers() {
        assert!(validate_job_id("e-studio_123").is_ok());
        assert!(validate_job_id("../other-file").is_err());
        assert!(validate_job_id("").is_err());
    }

    #[test]
    fn sends_a_valid_zpl_stream_over_the_configured_raw_tcp_connection() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind test printer");
        let address = listener.local_addr().expect("read test address");
        let receiver = thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept print connection");
            let mut bytes = Vec::new();
            stream
                .read_to_end(&mut bytes)
                .expect("read test print stream");
            bytes
        });
        let zpl = b"^XA^FO10,10^FDTEST^FS^XZ";

        send_zpl(address, zpl).expect("send to local test printer");

        assert_eq!(receiver.join().expect("join test receiver"), zpl);
    }
}
