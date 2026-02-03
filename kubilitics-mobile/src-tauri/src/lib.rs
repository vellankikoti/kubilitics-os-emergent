use tauri::command;

#[tauri::mobile_entry_point]
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            connect_to_cluster,
            get_topology,
        ])
        .run(tauri::generate_context!())
        .expect("error while running mobile application");
}

#[command]
async fn connect_to_cluster(backend_url: String) -> Result<String, String> {
    // Test connection to backend
    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/v1/clusters", backend_url))
        .send()
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    if response.status().is_success() {
        Ok("Connected".to_string())
    } else {
        Err("Connection failed".to_string())
    }
}

#[command]
async fn get_topology(backend_url: String, cluster_id: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/v1/clusters/{}/topology", backend_url, cluster_id))
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))
}
