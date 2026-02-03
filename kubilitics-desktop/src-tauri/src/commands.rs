use std::path::PathBuf;
use tauri::command;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize)]
pub struct KubeconfigContext {
    pub name: String,
    pub cluster: String,
    pub user: String,
    pub namespace: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KubeconfigInfo {
    pub path: String,
    pub current_context: Option<String>,
    pub contexts: Vec<KubeconfigContext>,
}

#[command]
pub async fn read_kubeconfig(path: Option<String>) -> Result<String, String> {
    let kubeconfig_path = get_kubeconfig_path(path)?;

    std::fs::read_to_string(kubeconfig_path)
        .map_err(|e| format!("Failed to read kubeconfig: {}", e))
}

#[command]
pub async fn get_kubeconfig_info(path: Option<String>) -> Result<KubeconfigInfo, String> {
    let kubeconfig_path = get_kubeconfig_path(path.clone())?;
    let content = std::fs::read_to_string(&kubeconfig_path)
        .map_err(|e| format!("Failed to read kubeconfig: {}", e))?;
    
    let config: Value = serde_yaml::from_str(&content)
        .map_err(|e| format!("Failed to parse kubeconfig: {}", e))?;
    
    let current_context = config.get("current-context")
        .and_then(|v| v.as_str())
        .map(String::from);
    
    let contexts = parse_contexts(&config)?;
    
    Ok(KubeconfigInfo {
        path: kubeconfig_path.to_string_lossy().to_string(),
        current_context,
        contexts,
    })
}

#[command]
pub async fn switch_context(context_name: String) -> Result<(), String> {
    let kubeconfig_path = get_kubeconfig_path(None)?;
    let content = std::fs::read_to_string(&kubeconfig_path)
        .map_err(|e| format!("Failed to read kubeconfig: {}", e))?;
    
    let mut config: Value = serde_yaml::from_str(&content)
        .map_err(|e| format!("Failed to parse kubeconfig: {}", e))?;
    
    // Validate context exists
    let contexts = parse_contexts(&config)?;
    if !contexts.iter().any(|c| c.name == context_name) {
        return Err(format!("Context '{}' not found", context_name));
    }
    
    // Update current-context
    if let Some(obj) = config.as_object_mut() {
        obj.insert("current-context".to_string(), Value::String(context_name));
    }
    
    // Write back
    let yaml = serde_yaml::to_string(&config)
        .map_err(|e| format!("Failed to serialize kubeconfig: {}", e))?;
    
    std::fs::write(&kubeconfig_path, yaml)
        .map_err(|e| format!("Failed to write kubeconfig: {}", e))?;
    
    Ok(())
}

#[command]
pub async fn validate_kubeconfig(path: Option<String>) -> Result<bool, String> {
    let kubeconfig_path = get_kubeconfig_path(path)?;
    
    if !kubeconfig_path.exists() {
        return Ok(false);
    }
    
    let content = match std::fs::read_to_string(&kubeconfig_path) {
        Ok(c) => c,
        Err(_) => return Ok(false),
    };
    
    match serde_yaml::from_str::<Value>(&content) {
        Ok(config) => {
            // Check required fields
            let has_clusters = config.get("clusters").is_some();
            let has_contexts = config.get("contexts").is_some();
            let has_users = config.get("users").is_some();
            
            Ok(has_clusters && has_contexts && has_users)
        }
        Err(_) => Ok(false),
    }
}

#[command]
pub async fn auto_detect_kubeconfig() -> Result<Vec<String>, String> {
    let mut paths = Vec::new();
    
    // Check default location
    if let Some(home) = dirs::home_dir() {
        let default_path = home.join(".kube").join("config");
        if default_path.exists() {
            paths.push(default_path.to_string_lossy().to_string());
        }
    }
    
    // Check KUBECONFIG env var
    if let Ok(kubeconfig_env) = std::env::var("KUBECONFIG") {
        for path in kubeconfig_env.split(':') {
            let p = PathBuf::from(path);
            if p.exists() && !paths.contains(&p.to_string_lossy().to_string()) {
                paths.push(p.to_string_lossy().to_string());
            }
        }
    }
    
    Ok(paths)
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

// Helper functions

fn get_kubeconfig_path(path: Option<String>) -> Result<PathBuf, String> {
    match path {
        Some(p) => Ok(PathBuf::from(p)),
        None => {
            let home = dirs::home_dir()
                .ok_or("Could not find home directory")?;
            Ok(home.join(".kube").join("config"))
        }
    }
}

fn parse_contexts(config: &Value) -> Result<Vec<KubeconfigContext>, String> {
    let contexts = config.get("contexts")
        .and_then(|v| v.as_sequence())
        .ok_or("No contexts found in kubeconfig")?;
    
    let mut result = Vec::new();
    
    for ctx in contexts {
        let name = ctx.get("name")
            .and_then(|v| v.as_str())
            .ok_or("Context missing name")?
            .to_string();
        
        let context = ctx.get("context")
            .ok_or("Context missing context field")?;
        
        let cluster = context.get("cluster")
            .and_then(|v| v.as_str())
            .ok_or("Context missing cluster")?
            .to_string();
        
        let user = context.get("user")
            .and_then(|v| v.as_str())
            .ok_or("Context missing user")?
            .to_string();
        
        let namespace = context.get("namespace")
            .and_then(|v| v.as_str())
            .map(String::from);
        
        result.push(KubeconfigContext {
            name,
            cluster,
            user,
            namespace,
        });
    }
    
    Ok(result)
}
