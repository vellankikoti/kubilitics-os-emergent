// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod sidecar;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::read_kubeconfig,
            commands::get_kubeconfig_info,
            commands::switch_context,
            commands::validate_kubeconfig,
            commands::auto_detect_kubeconfig,
            commands::browse_for_kubeconfig,
            commands::save_topology_export,
            commands::open_in_system_editor,
            commands::reveal_in_file_manager,
            commands::get_recent_exports,
            commands::get_app_data_dir,
            commands::select_kubeconfig_file,
        ])
        .setup(|app| {
            // Start Go backend sidecar
            sidecar::start_backend(&app.handle())?;
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
