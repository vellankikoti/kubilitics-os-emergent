use std::path::PathBuf;
use tauri::command;

#[command]
pub async fn read_kubeconfig(path: Option<String>) -> Result<String, String> {
    let kubeconfig_path = match path {
        Some(p) => PathBuf::from(p),
        None => {
            let home = dirs::home_dir()
                .ok_or("Could not find home directory")?;
            home.join(".kube").join("config")
        }
    };

    std::fs::read_to_string(kubeconfig_path)
        .map_err(|e| format!("Failed to read kubeconfig: {}", e))
}

#[command]
pub async fn get_app_data_dir() -> Result<String, String> {
    let data_dir = dirs::data_local_dir()
        .ok_or("Could not find data directory")?;
    
    let kubilitics_dir = data_dir.join("kubilitics");
    
    if !kubilitics_dir.exists() {
        std::fs::create_dir_all(&kubilitics_dir)
            .map_err(|e| format!("Failed to create data directory: {}", e))?;
    }
    
    Ok(kubilitics_dir.to_string_lossy().to_string())
}

#[command]
pub async fn select_kubeconfig_file() -> Result<Option<String>, String> {
    // This will be called from frontend using dialog plugin
    Ok(None)
}
