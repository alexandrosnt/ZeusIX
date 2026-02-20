mod commands;
mod plugins;

use commands::{crypto, keystore, ptt, screencap, storage};

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
        .setup(|app| {
            auto_grant_permissions(app)?;
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running ZeusIX");
}

/// Auto-grant media permissions (mic, camera, screen share) so users
/// don't see browser-style "Allow/Block" popups in a desktop app.
#[cfg(target_os = "linux")]
fn auto_grant_permissions(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::Manager;

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
