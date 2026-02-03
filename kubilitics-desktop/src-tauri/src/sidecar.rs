use tauri::{AppHandle, Manager};
use tauri_plugin_shell::ShellExt;

pub fn start_backend(app_handle: AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let sidecar_command = app_handle.shell().sidecar("kubilitics-backend")?;
    
    // Start backend on port 8080
    let (_rx, _child) = sidecar_command
        .args(["--port", "8080"])
        .spawn()?;

    println!("Kubilitics backend started on http://localhost:8080");
    
    Ok(())
}
