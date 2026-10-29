pub mod commands;
pub mod db;
pub mod external_db;
pub mod mcp_server;
pub mod printing;

use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."));
            let db_path = app_data_dir.join("estudio.sqlite");
            let conn = db::init_db(&db_path)
                .expect("Failed to initialize SQLite database for E-Studio");
            app.manage(commands::DbState(Mutex::new(conn), db_path));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::template_list,
            commands::template_get,
            commands::template_get_revision,
            commands::template_save,
            commands::template_delete,
            commands::catalog_search,
            commands::catalog_upsert,
            commands::catalog_replace_all,
            commands::catalog_commit_import,
            commands::job_insert,
            commands::job_list,
            commands::audit_append,
            commands::audit_list,
            commands::prefs_get,
            commands::prefs_set,
            commands::prefs_list,
            commands::batch_import_record,
            commands::batch_import_list,
            commands::database_restore,
            commands::backup_db,
            commands::restore_db,
            external_db::external_db_list_tables,
            external_db::external_db_fetch_table,
            commands::mcp_draft_list,
            commands::mcp_draft_read,
            commands::mcp_draft_remove,
            printing::print_capabilities,
            printing::print_list_queues,
            printing::print_submit_pdf,
            printing::print_submit_zpl,
            printing::print_refresh_job,
            printing::print_retry_job,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
