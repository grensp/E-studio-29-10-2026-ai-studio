#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if std::env::args().nth(1).as_deref() == Some("--mcp") {
        if let Err(error) = estudio_desktop_lib::mcp_server::run_stdio() {
            eprintln!("E-Studio MCP server stopped: {error}");
            std::process::exit(1);
        }
        return;
    }
    estudio_desktop_lib::run();
}
