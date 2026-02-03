use tauri::{AppHandle, Manager};
use tauri_plugin_shell::ShellExt;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::time::sleep;

const BACKEND_PORT: u16 = 8080;
const MAX_RESTART_ATTEMPTS: u32 = 3;
const HEALTH_CHECK_INTERVAL_SECS: u64 = 10;
const HEALTH_CHECK_TIMEOUT_SECS: u64 = 5;

pub struct BackendManager {
    app_handle: AppHandle,
    restart_count: Arc<Mutex<u32>>,
    is_running: Arc<Mutex<bool>>,
}

impl BackendManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            restart_count: Arc::new(Mutex::new(0)),
            is_running: Arc::new(Mutex::new(false)),
        }
    }

    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error>> {
        // Check for port conflicts
        if self.is_port_in_use(BACKEND_PORT).await {
            return Err(format!("Port {} is already in use", BACKEND_PORT).into());
        }

        self.start_backend_process().await?;
        self.start_health_monitor();
        
        Ok(())
    }

    async fn start_backend_process(&self) -> Result<(), Box<dyn std::error::Error>> {
        let sidecar_command = self.app_handle.shell().sidecar("kubilitics-backend")?;
        
        let (_rx, _child) = sidecar_command
            .env("KUBILITICS_PORT", BACKEND_PORT.to_string())
            .spawn()?;

        *self.is_running.lock().unwrap() = true;
        println!("Kubilitics backend started on http://localhost:{}", BACKEND_PORT);
        
        // Wait for backend to be ready
        self.wait_for_ready().await?;
        
        Ok(())
    }

    async fn wait_for_ready(&self) -> Result<(), Box<dyn std::error::Error>> {
        let url = format!("http://localhost:{}/health", BACKEND_PORT);
        
        for attempt in 1..=10 {
            if let Ok(response) = reqwest::get(&url).await {
                if response.status().is_success() {
                    println!("Backend is ready after {} attempts", attempt);
                    return Ok(());
                }
            }
            sleep(Duration::from_millis(500)).await;
        }
        
        Err("Backend failed to become ready within timeout".into())
    }

    async fn is_port_in_use(&self, port: u16) -> bool {
        let url = format!("http://localhost:{}/health", port);
        reqwest::get(&url).await.is_ok()
    }

    fn start_health_monitor(&self) {
        let app_handle = self.app_handle.clone();
        let restart_count = self.restart_count.clone();
        let is_running = self.is_running.clone();
        
        tokio::spawn(async move {
            loop {
                sleep(Duration::from_secs(HEALTH_CHECK_INTERVAL_SECS)).await;
                
                let running = {
                    let is_running_guard = is_running.lock().unwrap();
                    *is_running_guard
                };
                
                if !running {
                    continue;
                }
                
                if !Self::check_health(BACKEND_PORT).await {
                    println!("Backend health check failed. Attempting restart...");
                    
                    let count = {
                        let mut count_guard = restart_count.lock().unwrap();
                        *count_guard += 1;
                        *count_guard
                    };
                    
                    if count <= MAX_RESTART_ATTEMPTS {
                        let manager = BackendManager::new(app_handle.clone());
                        if let Err(e) = manager.start_backend_process().await {
                            eprintln!("Failed to restart backend: {}", e);
                        } else {
                            println!("Backend restarted successfully (attempt {})", count);
                        }
                    } else {
                        eprintln!("Max restart attempts reached. Backend will not restart.");
                        let mut running_guard = is_running.lock().unwrap();
                        *running_guard = false;
                    }
                }
            }
        });
    }

    async fn check_health(port: u16) -> bool {
        let url = format!("http://localhost:{}/health", port);
        
        match tokio::time::timeout(
            Duration::from_secs(HEALTH_CHECK_TIMEOUT_SECS),
            reqwest::get(&url)
        ).await {
            Ok(Ok(response)) => response.status().is_success(),
            _ => false,
        }
    }

    pub async fn stop(&self) -> Result<(), Box<dyn std::error::Error>> {
        *self.is_running.lock().unwrap() = false;
        
        // Send graceful shutdown signal to backend
        let url = format!("http://localhost:{}/api/v1/shutdown", BACKEND_PORT);
        let client = reqwest::Client::new();
        let _ = client.post(&url).send().await;
        
        // Wait for graceful shutdown
        sleep(Duration::from_secs(2)).await;
        
        println!("Backend stopped gracefully");
        Ok(())
    }
}

pub fn start_backend(app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let manager = BackendManager::new(app_handle.clone());
    
    tauri::async_runtime::spawn(async move {
        if let Err(e) = manager.start().await {
            eprintln!("Failed to start backend: {}", e);
        }
    });
    
    Ok(())
}
