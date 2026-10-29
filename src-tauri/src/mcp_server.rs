use serde_json::{json, Value};
use std::{
    collections::BTreeMap,
    fs::{self, OpenOptions},
    io::{self, BufRead, Write},
    path::PathBuf,
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

static DRAFT_COUNTER: AtomicU64 = AtomicU64::new(1);
const MAX_ITEMS: usize = 500;
const MAX_REQUEST_BYTES: usize = 1_048_576;

pub fn draft_directory() -> Result<PathBuf, String> {
    if let Some(path) = std::env::var_os("ESTUDIO_MCP_DRAFT_DIR") {
        return Ok(PathBuf::from(path));
    }
    #[cfg(target_os = "windows")]
    let base = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .ok_or_else(|| "LOCALAPPDATA is not set.".to_string())?
        .join("com.estudio.desktop");
    #[cfg(target_os = "macos")]
    let base = std::env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| "HOME is not set.".to_string())?
        .join("Library/Application Support/com.estudio.desktop");
    #[cfg(target_os = "linux")]
    let base = std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".local/share")))
        .ok_or_else(|| "Neither XDG_DATA_HOME nor HOME is set.".to_string())?
        .join("com.estudio.desktop");
    Ok(base.join("mcp-drafts"))
}

pub fn safe_draft_path(id: &str) -> Result<PathBuf, String> {
    if id.is_empty()
        || id.len() > 128
        || !id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
    {
        return Err("Invalid MCP draft id.".to_string());
    }
    Ok(draft_directory()?.join(format!("{id}.json")))
}

pub fn validate_template(template: &Value) -> Result<(), String> {
    let name = template
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if name.trim().is_empty() || name.len() > 200 {
        return Err("Template name must contain 1 to 200 characters.".to_string());
    }
    for dimension in ["width_mm", "height_mm"] {
        let value = template
            .get(dimension)
            .and_then(Value::as_f64)
            .unwrap_or_default();
        if !value.is_finite() || value <= 0.0 || value > 2000.0 {
            return Err(format!("{dimension} must be between 0 and 2000 mm."));
        }
    }
    let items = template
        .get("items")
        .and_then(Value::as_array)
        .ok_or_else(|| "Template items must be an array.".to_string())?;
    if items.len() > MAX_ITEMS {
        return Err(format!(
            "Templates may contain at most {MAX_ITEMS} objects."
        ));
    }
    if items.iter().any(|item| !item.is_object()) {
        return Err("Every template object must be a JSON object.".to_string());
    }
    Ok(())
}

fn create_draft(arguments: &Value) -> Result<Value, String> {
    let name = arguments
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim();
    let width_mm = arguments
        .get("width_mm")
        .and_then(Value::as_f64)
        .unwrap_or(100.0);
    let height_mm = arguments
        .get("height_mm")
        .and_then(Value::as_f64)
        .unwrap_or(50.0);
    let items = arguments
        .get("items")
        .cloned()
        .unwrap_or_else(|| Value::Array(Vec::new()));
    let now = chrono::Utc::now().to_rfc3339();
    let id = format!(
        "mcp_{}_{}_{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| error.to_string())?
            .as_millis(),
        std::process::id(),
        DRAFT_COUNTER.fetch_add(1, Ordering::Relaxed)
    );
    let template = json!({
        "id": id,
        "name": name,
        "revision": 1,
        "schema_version": 1,
        "created_at": now,
        "updated_at": now,
        "width_mm": width_mm,
        "height_mm": height_mm,
        "inner_margins_mm": {"top": 2, "bottom": 2, "left": 2, "right": 2},
        "outer_margins_mm": {"top": 1, "bottom": 1, "left": 1, "right": 1},
        "bg_color": "#FFFFFF",
        "bg_opacity": 1,
        "items": items
    });
    validate_template(&template)?;
    let directory = draft_directory()?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Unable to create draft directory: {error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&directory, fs::Permissions::from_mode(0o700))
            .map_err(|error| format!("Unable to secure MCP draft directory: {error}"))?;
    }
    let path = safe_draft_path(&id)?;
    let bytes = serde_json::to_vec(&template).map_err(|error| error.to_string())?;
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options
        .open(&path)
        .map_err(|error| format!("Unable to create MCP draft: {error}"))?;
    file.write_all(&bytes)
        .map_err(|error| format!("Unable to write MCP draft: {error}"))?;
    Ok(json!({
        "draft_id": id,
        "name": name,
        "status": "pending_user_approval",
        "message": "Draft is pending in E-Studio. It was not saved to the template library. The user must review and approve it in the desktop app."
    }))
}

fn inspect_template(arguments: &Value) -> Result<Value, String> {
    let template = arguments
        .get("template")
        .ok_or_else(|| "template is required.".to_string())?;
    validate_template(template)?;
    let items = template["items"].as_array().expect("validated items array");
    let mut object_types = BTreeMap::<String, usize>::new();
    for item in items {
        let kind = item
            .get("type")
            .and_then(Value::as_str)
            .or_else(|| item.get("kind").and_then(Value::as_str))
            .unwrap_or("unknown");
        *object_types.entry(kind.to_string()).or_default() += 1;
    }
    Ok(json!({
        "name": template["name"],
        "width_mm": template["width_mm"],
        "height_mm": template["height_mm"],
        "item_count": items.len(),
        "object_types": object_types,
        "status": "inspection_only"
    }))
}

fn tool_result(text: String) -> Value {
    json!({"content": [{"type": "text", "text": text}], "isError": false})
}

fn call_tool(name: &str, arguments: &Value) -> Result<Value, String> {
    match name {
        "label_inspect" => Ok(tool_result(
            serde_json::to_string_pretty(&inspect_template(arguments)?)
                .map_err(|error| error.to_string())?,
        )),
        "label_create_draft" => Ok(tool_result(
            serde_json::to_string_pretty(&create_draft(arguments)?)
                .map_err(|error| error.to_string())?,
        )),
        _ => Err(format!("Unknown tool: {name}")),
    }
}

fn handle_message(message: &Value) -> Option<Value> {
    let id = message.get("id")?.clone();
    let method = message
        .get("method")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let params = message.get("params").cloned().unwrap_or_else(|| json!({}));
    let result = match method {
        "initialize" => Ok(json!({
            "protocolVersion": params.get("protocolVersion").and_then(Value::as_str).unwrap_or("2024-11-05"),
            "capabilities": {"tools": {"listChanged": false}},
            "serverInfo": {"name": "e-studio-local", "version": env!("CARGO_PKG_VERSION")}
        })),
        "ping" => Ok(json!({})),
        "tools/list" => Ok(json!({
            "tools": [
                {
                    "name": "label_inspect",
                    "description": "Inspect a label template's dimensions and object types. Does not change local data.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {"template": {"type": "object"}},
                        "required": ["template"]
                    }
                },
                {
                    "name": "label_create_draft",
                    "description": "Create a local draft for user review. This never saves a template without explicit approval in the E-Studio desktop app.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string", "minLength": 1, "maxLength": 200},
                            "width_mm": {"type": "number", "minimum": 0.1, "maximum": 2000},
                            "height_mm": {"type": "number", "minimum": 0.1, "maximum": 2000},
                            "items": {"type": "array", "maxItems": 500, "items": {"type": "object"}}
                        },
                        "required": ["name", "width_mm", "height_mm", "items"]
                    }
                }
            ]
        })),
        "tools/call" => {
            let name = params
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or_default();
            let arguments = params
                .get("arguments")
                .cloned()
                .unwrap_or_else(|| json!({}));
            call_tool(name, &arguments)
        }
        _ => Err(format!("Method not found: {method}")),
    };
    Some(match result {
        Ok(value) => json!({"jsonrpc": "2.0", "id": id, "result": value}),
        Err(error) => {
            json!({"jsonrpc": "2.0", "id": id, "error": {"code": -32602, "message": error}})
        }
    })
}

pub fn run_stdio() -> Result<(), String> {
    let stdin = io::stdin();
    let mut stdout = io::stdout().lock();
    for line in stdin.lock().lines() {
        let line = line.map_err(|error| format!("Unable to read MCP request: {error}"))?;
        if line.len() > MAX_REQUEST_BYTES {
            return Err(format!("MCP request exceeds {MAX_REQUEST_BYTES} bytes."));
        }
        let request: Value = serde_json::from_str(&line)
            .map_err(|error| format!("Invalid MCP JSON request: {error}"))?;
        if let Some(response) = handle_message(&request) {
            serde_json::to_writer(&mut stdout, &response)
                .map_err(|error| format!("Unable to encode MCP response: {error}"))?;
            stdout
                .write_all(b"\n")
                .and_then(|_| stdout.flush())
                .map_err(|error| format!("Unable to send MCP response: {error}"))?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_dimensions_and_object_limits() {
        let valid = json!({
            "name": "Draft",
            "width_mm": 80,
            "height_mm": 40,
            "items": []
        });
        assert!(validate_template(&valid).is_ok());
        assert!(validate_template(&json!({
            "name": "Invalid",
            "width_mm": 0,
            "height_mm": 40,
            "items": []
        }))
        .is_err());
        assert!(validate_template(&json!({
            "name": "Invalid objects",
            "width_mm": 80,
            "height_mm": 40,
            "items": [null]
        }))
        .is_err());
    }

    #[test]
    fn lists_tools_and_inspects_without_writing_templates() {
        let listed = handle_message(&json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/list"
        }))
        .expect("request has an id");
        let names: Vec<&str> = listed["result"]["tools"]
            .as_array()
            .expect("tools list")
            .iter()
            .filter_map(|tool| tool["name"].as_str())
            .collect();
        assert_eq!(names, vec!["label_inspect", "label_create_draft"]);

        let inspected = call_tool(
            "label_inspect",
            &json!({"template": {
                "name": "Inspection",
                "width_mm": 80,
                "height_mm": 40,
                "items": [{"type": "text"}, {"type": "barcode"}]
            }}),
        )
        .expect("valid inspection");
        let report: Value =
            serde_json::from_str(inspected["content"][0]["text"].as_str().expect("tool text"))
                .expect("serialized report");
        assert_eq!(report["item_count"], 2);
        assert_eq!(report["object_types"]["text"], 1);
        assert_eq!(report["object_types"]["barcode"], 1);
        assert_eq!(report["status"], "inspection_only");
    }

    #[test]
    fn draft_path_rejects_traversal_and_unknown_files() {
        assert!(safe_draft_path("../escape").is_err());
        assert!(safe_draft_path("mcp_valid-id_1").is_ok());
    }
}
