# Kubilitics Desktop App Implementation Blueprint
## Tauri 2.0 - macOS, Windows, Linux

**Document Version:** 1.0
**Last Updated:** 2026-02-04
**Platform:** Tauri 2.0 + Rust 1.75+
**Target OS:** macOS 11+, Windows 10+, Linux (Ubuntu 20.04+)

---

## Table of Contents

1. [Tauri Architecture Overview](#1-tauri-architecture-overview)
2. [Project Setup & Configuration](#2-project-setup--configuration)
3. [Rust Backend Implementation](#3-rust-backend-implementation)
4. [Native Features Integration](#4-native-features-integration)
5. [Platform-Specific UI Adaptations](#5-platform-specific-ui-adaptations)
6. [File System Access](#6-file-system-access)
7. [System Integration](#7-system-integration)
8. [Auto-Updater Implementation](#8-auto-updater-implementation)
9. [Build & Distribution](#9-build--distribution)
10. [App Store Submission](#10-app-store-submission)

---

## 1. Tauri Architecture Overview

### 1.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    KUBILITICS DESKTOP APP                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              WEBVIEW (Frontend)                      │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │   React Application                            │  │  │
│  │  │   (Same as web, with Tauri APIs)               │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │ (IPC)                               │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │              TAURI CORE (Rust)                       │  │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────────────┐ │  │
│  │  │ Commands │  │  Events  │  │  Native APIs       │ │  │
│  │  └──────────┘  └──────────┘  └────────────────────┘ │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                     │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │           SYSTEM INTEGRATION                         │  │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────────────┐ │  │
│  │  │   File   │  │  Native  │  │   OS Features      │ │  │
│  │  │  System  │  │  Menus   │  │   (Notifications)  │ │  │
│  │  └──────────┘  └──────────┘  └────────────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│                       │                                     │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │         GO BACKEND (Sidecar Process)                 │  │
│  │  Kubilitics Backend Server on localhost:8080        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Why Tauri?

**Advantages:**
- **Small Bundle Size**: 2-5MB (vs 100MB+ with Electron)
- **Native Performance**: Rust backend, native webview
- **Security**: Process isolation, restricted APIs
- **Cross-Platform**: Single codebase for macOS, Windows, Linux
- **Modern**: Uses system webview (Safari on macOS, Edge on Windows)

**Challenges:**
- Webview inconsistencies across platforms
- More complex native development (Rust vs Node.js)
- Smaller ecosystem than Electron

---

## 2. Project Setup & Configuration

### 2.1 Directory Structure

```
kubilitics-desktop/
├── src/                          # React frontend (same as web)
│   ├── app/
│   ├── components/
│   ├── screens/
│   └── main.tsx
│
├── src-tauri/                    # Tauri backend (Rust)
│   ├── src/
│   │   ├── main.rs              # Entry point
│   │   ├── commands.rs          # Tauri commands
│   │   ├── menu.rs              # Native menu
│   │   ├── fs.rs                # File system operations
│   │   ├── sidecar.rs           # Go backend process management
│   │   ├── updater.rs           # Auto-updater
│   │   └── tray.rs              # System tray
│   │
│   ├── icons/                    # App icons
│   │   ├── icon.icns            # macOS
│   │   ├── icon.ico             # Windows
│   │   └── icon.png             # Linux
│   │
│   ├── Cargo.toml               # Rust dependencies
│   ├── tauri.conf.json          # Tauri configuration
│   └── build.rs                 # Build script
│
├── backend/                      # Go backend (sidecar)
│   └── server                   # Compiled binary
│
├── package.json
└── README.md
```

### 2.2 Tauri Configuration

```json
// src-tauri/tauri.conf.json
{
  "$schema": "https://tauri.app/schema/tauri.conf.json",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:5173",
    "distDir": "../dist",
    "withGlobalTauri": false
  },
  "package": {
    "productName": "Kubilitics",
    "version": "1.0.0"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "fs": {
        "all": false,
        "readFile": true,
        "writeFile": true,
        "readDir": true,
        "copyFile": true,
        "createDir": true,
        "removeDir": true,
        "removeFile": true,
        "renameFile": true,
        "exists": true,
        "scope": ["$HOME/.kube/**", "$APPDATA/kubilitics/**"]
      },
      "shell": {
        "all": false,
        "sidecar": true,
        "scope": [
          {
            "name": "backend",
            "sidecar": true,
            "args": true
          }
        ]
      },
      "dialog": {
        "all": false,
        "open": true,
        "save": true,
        "message": true,
        "ask": true,
        "confirm": true
      },
      "notification": {
        "all": true
      },
      "clipboard": {
        "all": true,
        "writeText": true,
        "readText": true
      },
      "globalShortcut": {
        "all": true
      },
      "os": {
        "all": true
      },
      "path": {
        "all": true
      },
      "process": {
        "all": false,
        "exit": true,
        "relaunch": true
      },
      "protocol": {
        "all": false,
        "asset": true,
        "assetScope": ["$APPDATA/**"]
      },
      "window": {
        "all": false,
        "center": true,
        "close": true,
        "create": true,
        "hide": true,
        "maximize": true,
        "minimize": true,
        "print": true,
        "requestUserAttention": true,
        "setAlwaysOnTop": true,
        "setDecorations": true,
        "setFocus": true,
        "setFullscreen": true,
        "setIcon": true,
        "setMaxSize": true,
        "setMinSize": true,
        "setPosition": true,
        "setResizable": true,
        "setSize": true,
        "setSkipTaskbar": true,
        "setTitle": true,
        "show": true,
        "startDragging": true,
        "unmaximize": true,
        "unminimize": true
      }
    },
    "bundle": {
      "active": true,
      "category": "DeveloperTool",
      "copyright": "© 2026 Kubilitics",
      "deb": {
        "depends": []
      },
      "externalBin": ["backend/server"],
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ],
      "identifier": "com.kubilitics.app",
      "longDescription": "The Kubernetes OS - Making Kubernetes finally human-friendly",
      "macOS": {
        "entitlements": null,
        "exceptionDomain": "",
        "frameworks": [],
        "providerShortName": null,
        "signingIdentity": null,
        "minimumSystemVersion": "11.0"
      },
      "resources": [],
      "shortDescription": "Kubernetes Management Platform",
      "targets": "all",
      "windows": {
        "certificateThumbprint": null,
        "digestAlgorithm": "sha256",
        "timestampUrl": ""
      }
    },
    "security": {
      "csp": "default-src 'self'; connect-src 'self' http://localhost:8080 ws://localhost:8080; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
    },
    "updater": {
      "active": true,
      "endpoints": [
        "https://releases.kubilitics.com/{{target}}/{{current_version}}"
      ],
      "dialog": true,
      "pubkey": "YOUR_PUBLIC_KEY_HERE"
    },
    "windows": [
      {
        "fullscreen": false,
        "resizable": true,
        "title": "Kubilitics",
        "width": 1400,
        "height": 900,
        "minWidth": 1024,
        "minHeight": 768,
        "center": true,
        "decorations": true,
        "transparent": false,
        "alwaysOnTop": false,
        "titleBarStyle": "Overlay"
      }
    ],
    "systemTray": {
      "iconPath": "icons/tray-icon.png",
      "iconAsTemplate": true,
      "menuOnLeftClick": false
    }
  }
}
```

### 2.3 Cargo Dependencies

```toml
# src-tauri/Cargo.toml
[package]
name = "kubilitics"
version = "1.0.0"
description = "The Kubernetes OS"
authors = ["Kubilitics Team"]
license = "Apache-2.0"
repository = "https://github.com/kubilitics/kubilitics"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2.0.0-beta", features = [] }

[dependencies]
tauri = { version = "2.0.0-beta", features = [
    "shell-sidecar",
    "fs-read-file",
    "fs-write-file",
    "dialog-all",
    "notification-all",
    "clipboard-all",
    "global-shortcut-all",
    "os-all",
    "path-all",
    "process-exit",
    "process-relaunch",
    "protocol-asset",
    "window-all",
    "tray-icon",
    "updater"
] }
tauri-plugin-fs = "2.0.0-beta"
tauri-plugin-shell = "2.0.0-beta"
tauri-plugin-dialog = "2.0.0-beta"
tauri-plugin-notification = "2.0.0-beta"
tauri-plugin-updater = "2.0.0-beta"
tauri-plugin-store = "2.0.0-beta"

serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1", features = ["full"] }
dirs = "5.0"
anyhow = "1.0"
log = "0.4"
env_logger = "0.11"

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]

[profile.release]
panic = "abort"
codegen-units = 1
lto = true
opt-level = "z"
strip = true
```

---

## 3. Rust Backend Implementation

### 3.1 Main Entry Point

```rust
// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod menu;
mod fs;
mod sidecar;
mod updater;
mod tray;

use tauri::{Manager, WindowEvent};
use log::{info, error};

fn main() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            commands::read_kubeconfig,
            commands::write_kubeconfig,
            commands::select_kubeconfig_file,
            commands::get_app_data_dir,
            commands::get_logs_dir,
            commands::open_in_default_app,
            commands::show_in_folder,
            commands::copy_to_clipboard,
            commands::check_for_updates,
        ])
        .setup(|app| {
            // Initialize logging
            info!("Kubilitics starting...");

            // Create app directories
            fs::ensure_app_dirs(app)?;

            // Set up native menu
            let menu = menu::create_menu(app)?;
            app.set_menu(menu)?;

            // Set up system tray
            tray::setup_tray(app)?;

            // Start Go backend sidecar
            sidecar::start_backend(app)?;

            // Check for updates on startup
            updater::check_updates_on_startup(app.handle());

            // Set up window event handlers
            let window = app.get_window("main").unwrap();
            window.on_window_event(|event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    // Hide to tray instead of closing (optional)
                    #[cfg(target_os = "macos")]
                    {
                        api.prevent_close();
                        event.window().hide().unwrap();
                    }
                }
            });

            Ok(())
        })
        .on_menu_event(menu::handle_menu_event)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 3.2 Tauri Commands

```rust
// src-tauri/src/commands.rs
use tauri::command;
use std::path::PathBuf;
use anyhow::Result;

#[command]
pub fn read_kubeconfig(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read kubeconfig: {}", e))
}

#[command]
pub fn write_kubeconfig(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content)
        .map_err(|e| format!("Failed to write kubeconfig: {}", e))
}

#[command]
pub async fn select_kubeconfig_file(app: tauri::AppHandle) -> Result<Option<PathBuf>, String> {
    use tauri_plugin_dialog::{DialogExt, FileDialogBuilder};

    let file_path = app.dialog()
        .file()
        .add_filter("Kubeconfig", &["yaml", "yml", "conf"])
        .pick_file()
        .await;

    Ok(file_path)
}

#[command]
pub fn get_app_data_dir(app: tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))
}

#[command]
pub fn get_logs_dir(app: tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_log_dir()
        .map_err(|e| format!("Failed to get logs dir: {}", e))
}

#[command]
pub fn open_in_default_app(path: String) -> Result<(), String> {
    opener::open(&path)
        .map_err(|e| format!("Failed to open: {}", e))
}

#[command]
pub fn show_in_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| format!("Failed to show in folder: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| format!("Failed to show in folder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(std::path::Path::new(&path).parent().unwrap())
            .spawn()
            .map_err(|e| format!("Failed to show in folder: {}", e))?;
    }

    Ok(())
}

#[command]
pub async fn copy_to_clipboard(text: String, app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_clipboard::ClipboardExt;

    app.clipboard()
        .write_text(text)
        .map_err(|e| format!("Failed to copy: {}", e))
}

#[command]
pub async fn check_for_updates(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri_plugin_updater::UpdaterExt;

    let updater = app.updater_builder().build()
        .map_err(|e| format!("Failed to create updater: {}", e))?;

    let update = updater.check().await
        .map_err(|e| format!("Failed to check for updates: {}", e))?;

    Ok(update.is_some())
}
```

---

## 4. Native Features Integration

### 4.1 Native Menu (macOS)

```rust
// src-tauri/src/menu.rs
use tauri::{AboutMetadata, CustomMenuItem, Menu, MenuItem, Submenu, WindowMenuEvent};

pub fn create_menu(app: &tauri::App) -> Result<Menu, Box<dyn std::error::Error>> {
    let about_metadata = AboutMetadata {
        name: Some("Kubilitics".into()),
        version: Some(env!("CARGO_PKG_VERSION").into()),
        copyright: Some("© 2026 Kubilitics".into()),
        ..Default::default()
    };

    // App menu (macOS)
    let app_menu = Submenu::new(
        "Kubilitics",
        Menu::new()
            .add_native_item(MenuItem::About("Kubilitics".into(), about_metadata))
            .add_native_item(MenuItem::Separator)
            .add_item(CustomMenuItem::new("check_updates", "Check for Updates..."))
            .add_native_item(MenuItem::Separator)
            .add_item(CustomMenuItem::new("preferences", "Preferences...").accelerator("Cmd+,"))
            .add_native_item(MenuItem::Separator)
            .add_native_item(MenuItem::Services)
            .add_native_item(MenuItem::Separator)
            .add_native_item(MenuItem::Hide)
            .add_native_item(MenuItem::HideOthers)
            .add_native_item(MenuItem::ShowAll)
            .add_native_item(MenuItem::Separator)
            .add_native_item(MenuItem::Quit),
    );

    // File menu
    let file_menu = Submenu::new(
        "File",
        Menu::new()
            .add_item(CustomMenuItem::new("new_window", "New Window").accelerator("Cmd+N"))
            .add_item(CustomMenuItem::new("open_kubeconfig", "Open Kubeconfig...").accelerator("Cmd+O"))
            .add_native_item(MenuItem::Separator)
            .add_item(CustomMenuItem::new("export_topology", "Export Topology...").accelerator("Cmd+E"))
            .add_native_item(MenuItem::Separator)
            .add_native_item(MenuItem::CloseWindow),
    );

    // Edit menu
    let edit_menu = Submenu::new(
        "Edit",
        Menu::new()
            .add_native_item(MenuItem::Undo)
            .add_native_item(MenuItem::Redo)
            .add_native_item(MenuItem::Separator)
            .add_native_item(MenuItem::Cut)
            .add_native_item(MenuItem::Copy)
            .add_native_item(MenuItem::Paste)
            .add_native_item(MenuItem::SelectAll),
    );

    // View menu
    let view_menu = Submenu::new(
        "View",
        Menu::new()
            .add_item(CustomMenuItem::new("toggle_sidebar", "Toggle Sidebar").accelerator("Cmd+B"))
            .add_item(CustomMenuItem::new("topology_view", "Topology").accelerator("Cmd+1"))
            .add_item(CustomMenuItem::new("resources_view", "Resources").accelerator("Cmd+2"))
            .add_native_item(MenuItem::Separator)
            .add_native_item(MenuItem::EnterFullScreen),
    );

    // Window menu
    let window_menu = Submenu::new(
        "Window",
        Menu::new()
            .add_native_item(MenuItem::Minimize)
            .add_native_item(MenuItem::Zoom)
            .add_native_item(MenuItem::Separator)
            .add_item(CustomMenuItem::new("bring_all_to_front", "Bring All to Front")),
    );

    // Help menu
    let help_menu = Submenu::new(
        "Help",
        Menu::new()
            .add_item(CustomMenuItem::new("documentation", "Documentation"))
            .add_item(CustomMenuItem::new("keyboard_shortcuts", "Keyboard Shortcuts").accelerator("Cmd+/"))
            .add_native_item(MenuItem::Separator)
            .add_item(CustomMenuItem::new("report_issue", "Report Issue..."))
            .add_item(CustomMenuItem::new("join_community", "Join Community")),
    );

    let menu = Menu::new()
        .add_submenu(app_menu)
        .add_submenu(file_menu)
        .add_submenu(edit_menu)
        .add_submenu(view_menu)
        .add_submenu(window_menu)
        .add_submenu(help_menu);

    Ok(menu)
}

pub fn handle_menu_event(event: WindowMenuEvent) {
    match event.menu_item_id() {
        "check_updates" => {
            // Trigger update check
            let app = event.window().app_handle();
            tauri::async_runtime::spawn(async move {
                crate::updater::check_for_updates(app).await;
            });
        }
        "preferences" => {
            // Navigate to settings
            event.window().emit("navigate", "/settings").unwrap();
        }
        "open_kubeconfig" => {
            // Open file dialog
            event.window().emit("open-kubeconfig-dialog", ()).unwrap();
        }
        "export_topology" => {
            event.window().emit("export-topology", ()).unwrap();
        }
        "toggle_sidebar" => {
            event.window().emit("toggle-sidebar", ()).unwrap();
        }
        "topology_view" => {
            event.window().emit("navigate", "/topology").unwrap();
        }
        "resources_view" => {
            event.window().emit("navigate", "/resources").unwrap();
        }
        "documentation" => {
            opener::open("https://docs.kubilitics.com").unwrap();
        }
        "keyboard_shortcuts" => {
            event.window().emit("show-keyboard-shortcuts", ()).unwrap();
        }
        "report_issue" => {
            opener::open("https://github.com/kubilitics/kubilitics/issues/new").unwrap();
        }
        "join_community" => {
            opener::open("https://discord.gg/kubilitics").unwrap();
        }
        _ => {}
    }
}
```

### 4.2 System Tray

```rust
// src-tauri/src/tray.rs
use tauri::{
    AppHandle, CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu,
    SystemTrayMenuItem,
};

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show = CustomMenuItem::new("show".to_string(), "Show Kubilitics");
    let topology = CustomMenuItem::new("topology".to_string(), "Open Topology");
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");

    let tray_menu = SystemTrayMenu::new()
        .add_item(show)
        .add_item(topology)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(quit);

    let tray = SystemTray::new().with_menu(tray_menu);

    tray.build(app)?;

    Ok(())
}

pub fn handle_tray_event(app: &AppHandle, event: SystemTrayEvent) {
    match event {
        SystemTrayEvent::LeftClick { .. } => {
            let window = app.get_window("main").unwrap();
            window.show().unwrap();
            window.set_focus().unwrap();
        }
        SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
            "show" => {
                let window = app.get_window("main").unwrap();
                window.show().unwrap();
                window.set_focus().unwrap();
            }
            "topology" => {
                let window = app.get_window("main").unwrap();
                window.show().unwrap();
                window.set_focus().unwrap();
                window.emit("navigate", "/topology").unwrap();
            }
            "quit" => {
                std::process::exit(0);
            }
            _ => {}
        },
        _ => {}
    }
}
```

### 4.3 Global Shortcuts

```rust
// src-tauri/src/main.rs (add to setup)
use tauri::GlobalShortcutManager;

// In setup() function:
let mut shortcuts = app.global_shortcut_manager();

// Register Cmd/Ctrl + K for search
shortcuts
    .register("CmdOrCtrl+K", || {
        // Emit event to frontend
        app.emit_all("open-search", ()).unwrap();
    })
    .unwrap();

// Register Cmd/Ctrl + , for settings
shortcuts
    .register("CmdOrCtrl+,", || {
        app.emit_all("navigate", "/settings").unwrap();
    })
    .unwrap();
```

---

## 5. Platform-Specific UI Adaptations

### 5.1 Detect Platform in React

```typescript
// src/lib/platform.ts
import { platform } from '@tauri-apps/plugin-os';

export type Platform = 'macos' | 'windows' | 'linux' | 'web';

export function getPlatform(): Platform {
  if (typeof window.__TAURI__ === 'undefined') {
    return 'web';
  }

  const os = platform();
  if (os === 'darwin') return 'macos';
  if (os === 'win32') return 'windows';
  return 'linux';
}

export const isMac = () => getPlatform() === 'macos';
export const isWindows = () => getPlatform() === 'windows';
export const isLinux = () => getPlatform() === 'linux';
export const isDesktop = () => typeof window.__TAURI__ !== 'undefined';
```

### 5.2 Platform-Specific Components

```typescript
// src/components/layout/TitleBar.tsx
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isMac, isWindows } from '@/lib/platform';

export function TitleBar() {
  const appWindow = getCurrentWindow();

  if (!isDesktop()) return null; // No custom title bar on web

  if (isMac()) {
    // macOS uses native title bar
    return null;
  }

  // Custom title bar for Windows/Linux
  return (
    <div
      data-tauri-drag-region
      className="h-8 bg-background border-b flex items-center justify-between px-2"
    >
      <div className="flex items-center gap-2">
        <img src="/icon.png" className="h-4 w-4" />
        <span className="text-sm font-medium">Kubilitics</span>
      </div>

      <div className="flex">
        <button
          onClick={() => appWindow.minimize()}
          className="h-8 w-12 hover:bg-muted flex items-center justify-center"
        >
          <Minimize2 className="h-4 w-4" />
        </button>
        <button
          onClick={() => appWindow.toggleMaximize()}
          className="h-8 w-12 hover:bg-muted flex items-center justify-center"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        <button
          onClick={() => appWindow.close()}
          className="h-8 w-12 hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
```

### 5.3 Platform-Specific Keyboard Shortcuts

```typescript
// Show "Cmd" on macOS, "Ctrl" on Windows/Linux
export function KeyboardShortcut({ keys }: { keys: string[] }) {
  const platform = getPlatform();

  const displayKeys = keys.map(key => {
    if (key === 'mod') {
      return platform === 'macos' ? '⌘' : 'Ctrl';
    }
    return key;
  });

  return (
    <div className="flex gap-1">
      {displayKeys.map(key => (
        <kbd key={key} className="px-2 py-1 rounded bg-muted text-xs">
          {key}
        </kbd>
      ))}
    </div>
  );
}
```

---

## 6. File System Access

### 6.1 Reading Kubeconfig

```typescript
// src/services/tauri/filesystem.ts
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { appDataDir } from '@tauri-apps/api/path';

export async function readKubeconfig(path?: string): Promise<string> {
  const kubeconfigPath = path || await getDefaultKubeconfigPath();
  return await invoke<string>('read_kubeconfig', { path: kubeconfigPath });
}

export async function writeKubeconfig(content: string, path?: string): Promise<void> {
  const kubeconfigPath = path || await getDefaultKubeconfigPath();
  await invoke('write_kubeconfig', { path: kubeconfigPath, content });
}

export async function selectKubeconfigFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{
      name: 'Kubeconfig',
      extensions: ['yaml', 'yml', 'conf', '']
    }]
  });

  return selected as string | null;
}

async function getDefaultKubeconfigPath(): Promise<string> {
  const homeDir = await homeDir();
  return `${homeDir}/.kube/config`;
}

export async function getAppDataDirectory(): Promise<string> {
  return await invoke('get_app_data_dir');
}

export async function getLogsDirectory(): Promise<string> {
  return await invoke('get_logs_dir');
}
```

---

## 7. System Integration

### 7.1 Notifications

```typescript
// src/services/tauri/notifications.ts
import { sendNotification, isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';

export async function showNotification(title: string, body: string) {
  let permissionGranted = await isPermissionGranted();

  if (!permissionGranted) {
    const permission = await requestPermission();
    permissionGranted = permission === 'granted';
  }

  if (permissionGranted) {
    sendNotification({ title, body });
  }
}

// Usage
showNotification('Pod Failed', 'nginx-deployment-abc123 has failed');
```

### 7.2 Deep Links

Register custom URL scheme `kubilitics://`:

```rust
// src-tauri/tauri.conf.json (add to bundle)
"deeplink": {
  "protocol": "kubilitics",
  "schemes": ["kubilitics"]
}
```

Handle deep links:

```typescript
// src/app/App.tsx
import { listen } from '@tauri-apps/api/event';

useEffect(() => {
  // Listen for deep link events
  const unlisten = listen<string>('deep-link', (event) => {
    const url = event.payload;
    // Parse: kubilitics://pods/default/nginx
    const match = url.match(/kubilitics:\/\/(.+)/);
    if (match) {
      navigate(`/${match[1]}`);
    }
  });

  return () => {
    unlisten.then(fn => fn());
  };
}, []);
```

---

## 8. Auto-Updater Implementation

### 8.1 Update Check on Startup

```rust
// src-tauri/src/updater.rs
use tauri::{AppHandle, Manager};
use tauri_plugin_updater::UpdaterExt;
use log::{info, error};

pub fn check_updates_on_startup(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;

        info!("Checking for updates...");

        match app.updater_builder().build() {
            Ok(updater) => {
                match updater.check().await {
                    Ok(Some(update)) => {
                        info!("Update available: {}", update.version);

                        // Show dialog to user
                        app.emit_all("update-available", &update.version).unwrap();
                    }
                    Ok(None) => {
                        info!("No updates available");
                    }
                    Err(e) => {
                        error!("Failed to check for updates: {}", e);
                    }
                }
            }
            Err(e) => {
                error!("Failed to create updater: {}", e);
            }
        }
    });
}

pub async fn check_for_updates(app: AppHandle) -> Result<(), String> {
    let updater = app.updater_builder().build()
        .map_err(|e| format!("Failed to create updater: {}", e))?;

    match updater.check().await {
        Ok(Some(update)) => {
            info!("Update found: {}", update.version);

            // Download and install
            update.download_and_install(
                |chunk_length, content_length| {
                    let progress = (chunk_length as f64 / content_length.unwrap_or(1) as f64) * 100.0;
                    app.emit_all("update-progress", progress).unwrap();
                },
                || {
                    info!("Update downloaded, restarting...");
                }
            ).await
                .map_err(|e| format!("Failed to install update: {}", e))?;

            Ok(())
        }
        Ok(None) => {
            app.emit_all("update-not-available", ()).unwrap();
            Ok(())
        }
        Err(e) => Err(format!("Update check failed: {}", e))
    }
}
```

### 8.2 Frontend Update UI

```typescript
// src/components/UpdateDialog.tsx
import { listen } from '@tauri-apps/api/event';
import { relaunch } from '@tauri-apps/plugin-process';

export function UpdateDialog() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [version, setVersion] = useState('');
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const unlistenAvailable = listen<string>('update-available', (event) => {
      setVersion(event.payload);
      setUpdateAvailable(true);
    });

    const unlistenProgress = listen<number>('update-progress', (event) => {
      setProgress(event.payload);
    });

    return () => {
      unlistenAvailable.then(fn => fn());
      unlistenProgress.then(fn => fn());
    };
  }, []);

  const handleUpdate = async () => {
    setDownloading(true);
    await invoke('check_for_updates');
    // App will relaunch after update
  };

  if (!updateAvailable) return null;

  return (
    <Dialog open={updateAvailable}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Available</DialogTitle>
          <DialogDescription>
            Version {version} is available. Would you like to update now?
          </DialogDescription>
        </DialogHeader>

        {downloading && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground">
              Downloading update... {Math.round(progress)}%
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setUpdateAvailable(false)} disabled={downloading}>
            Later
          </Button>
          <Button onClick={handleUpdate} disabled={downloading}>
            {downloading ? 'Downloading...' : 'Update Now'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 9. Build & Distribution

### 9.1 Build Commands

```bash
# Development
npm run tauri dev

# Production build
npm run tauri build

# Platform-specific builds
npm run tauri build -- --target x86_64-apple-darwin  # macOS Intel
npm run tauri build -- --target aarch64-apple-darwin # macOS Apple Silicon
npm run tauri build -- --target x86_64-pc-windows-msvc # Windows
npm run tauri build -- --target x86_64-unknown-linux-gnu # Linux
```

### 9.2 Build Script

```json
// package.json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "tauri:build:mac": "tauri build --target universal-apple-darwin",
    "tauri:build:windows": "tauri build --target x86_64-pc-windows-msvc",
    "tauri:build:linux": "tauri build --target x86_64-unknown-linux-gnu"
  }
}
```

### 9.3 Code Signing

**macOS:**
```bash
# Sign app
codesign --deep --force --verify --verbose \
  --sign "Developer ID Application: Your Name (TEAM_ID)" \
  src-tauri/target/release/bundle/macos/Kubilitics.app

# Notarize
xcrun notarytool submit src-tauri/target/release/bundle/macos/Kubilitics.app.zip \
  --apple-id your@email.com \
  --team-id TEAM_ID \
  --password APP_SPECIFIC_PASSWORD \
  --wait

# Staple notarization ticket
xcrun stapler staple src-tauri/target/release/bundle/macos/Kubilitics.app
```

**Windows:**
```bash
# Sign with certificate
signtool sign /f certificate.pfx /p PASSWORD \
  /t http://timestamp.digicert.com \
  src-tauri/target/release/Kubilitics.exe
```

---

## 10. App Store Submission

### 10.1 Mac App Store

**Entitlements** (`src-tauri/entitlements.plist`):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
</dict>
</plist>
```

**Submission:**
```bash
# Create app package
xcrun productbuild --component Kubilitics.app /Applications Kubilitics.pkg

# Upload to App Store Connect
xcrun altool --upload-app --type macos --file Kubilitics.pkg \
  --username your@email.com --password APP_SPECIFIC_PASSWORD
```

### 10.2 Microsoft Store

1. Create MSIX package
2. Submit via Partner Center
3. Follow certification guidelines

---

**(End of Desktop Implementation Blueprint)**

Next: Mobile implementation...
