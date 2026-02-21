mod commands;
mod plugins;

use commands::{crypto, keystore, ptt, screencap, storage, tray};
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_stronghold::Builder::new(|password| {
            use sha2::{Digest, Sha256};
            let mut hasher = Sha256::new();
            hasher.update(password);
            hasher.finalize().to_vec()
        }).build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            auto_grant_permissions(app)?;
            setup_tray(app)?;
            setup_close_to_tray(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Crypto commands
            crypto::generate_keypair,
            crypto::encrypt_message,
            crypto::decrypt_message,
            crypto::derive_shared_secret,
            // Storage commands
            storage::init_local_db,
            storage::store_message,
            storage::get_messages,
            storage::clear_messages,
            // Keystore commands
            keystore::init_keystore,
            keystore::store_key,
            keystore::get_key,
            // PTT (Push-to-Talk) global key listener
            ptt::start_ptt_listener,
            ptt::stop_ptt_listener,
            // Screen capture (native → JPEG buffer)
            screencap::enumerate_capture_sources,
            screencap::start_capture,
            screencap::stop_capture,
            screencap::get_capture_frame,
            screencap::is_capturing,
            // Tray icon
            tray::set_minimize_to_tray,
            tray::update_tray_icon,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ZeusIX");
}

fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{MenuBuilder, MenuItemBuilder};
    use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};

    let check_updates = MenuItemBuilder::new("Check for Updates")
        .id("check_updates")
        .build(app)?;
    let quit = MenuItemBuilder::new("Quit")
        .id("quit")
        .build(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[&check_updates, &quit])
        .build()?;

    TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("ZeusIX")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "check_updates" => {
                    // Show window and emit event for JS to handle
                    if let Some(win) = app.get_webview_window("main") {
                        win.show().ok();
                        win.set_focus().ok();
                    }
                    app.emit("tray-check-updates", ()).ok();
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                if let Some(win) = tray.app_handle().get_webview_window("main") {
                    win.show().ok();
                    win.set_focus().ok();
                }
            }
        })
        .build(app)?;

    Ok(())
}

fn setup_close_to_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::WindowEvent;

    let window = app.get_webview_window("main")
        .expect("main window not found");
    let win_hide = window.clone();

    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            if tray::should_minimize_to_tray() {
                api.prevent_close();
                win_hide.hide().unwrap_or(());
            }
        }
    });

    Ok(())
}

/// Auto-grant media permissions (mic, camera, screen share) so users
/// don't see browser-style "Allow/Block" popups in a desktop app.
#[cfg(target_os = "linux")]
fn auto_grant_permissions(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let window = app.get_webview_window("main")
        .expect("main window not found");

    window.with_webview(move |webview| {
        use webkit2gtk::PermissionRequestExt;
        use webkit2gtk::WebViewExt;

        let wv = webview.inner();
        wv.connect_permission_request(|_webview, request| {
            request.allow();
            true
        });
    })?;

    Ok(())
}

/// On Windows, WebView2 auto-grants permissions for localhost/tauri origins.
#[cfg(not(target_os = "linux"))]
fn auto_grant_permissions(_app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}
