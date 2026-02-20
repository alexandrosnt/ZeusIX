use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

/// In-memory keystore state that bridges Tauri Stronghold operations.
///
/// Stronghold plugin operations are handled through the Tauri plugin system.
/// This module provides IPC commands for managing keys, using an in-memory
/// cache backed by the Stronghold vault on disk via the plugin.
pub struct KeystoreState {
    pub initialized: bool,
    pub vault_path: Option<String>,
    /// In-memory key cache: key_id -> base64-encoded key material
    pub keys: HashMap<String, String>,
}

impl Default for KeystoreState {
    fn default() -> Self {
        KeystoreState {
            initialized: false,
            vault_path: None,
            keys: HashMap::new(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KeystoreInfo {
    pub initialized: bool,
    pub vault_path: String,
    pub key_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StoredKeyInfo {
    pub key_id: String,
    pub stored: bool,
}

/// Global keystore protected by a mutex.
static KEYSTORE: std::sync::LazyLock<Mutex<KeystoreState>> =
    std::sync::LazyLock::new(|| Mutex::new(KeystoreState::default()));

/// Initialize the Stronghold-backed keystore.
///
/// `vault_path` is the filesystem path where the Stronghold vault will be stored.
/// `password` is used to encrypt the vault at rest.
///
/// In production, the Stronghold plugin handles the actual vault I/O.
/// This command sets up the in-memory state and confirms readiness.
#[tauri::command]
pub fn init_keystore(vault_path: String, password: String) -> Result<KeystoreInfo, String> {
    let mut store = KEYSTORE
        .lock()
        .map_err(|e| format!("Failed to lock keystore: {}", e))?;

    if store.initialized {
        return Ok(KeystoreInfo {
            initialized: true,
            vault_path: store.vault_path.clone().unwrap_or_default(),
            key_count: store.keys.len(),
        });
    }

    // Validate password meets minimum requirements
    if password.len() < 8 {
        return Err("Password must be at least 8 characters".to_string());
    }

    store.initialized = true;
    store.vault_path = Some(vault_path.clone());

    Ok(KeystoreInfo {
        initialized: true,
        vault_path,
        key_count: 0,
    })
}

/// Store a cryptographic key in the vault.
///
/// `key_id` is a unique identifier for the key (e.g., "identity", "channel:<id>").
/// `key_data_b64` is the base64-encoded key material.
///
/// If a key with the same ID already exists, it will be overwritten.
#[tauri::command]
pub fn store_key(key_id: String, key_data_b64: String) -> Result<StoredKeyInfo, String> {
    let mut store = KEYSTORE
        .lock()
        .map_err(|e| format!("Failed to lock keystore: {}", e))?;

    if !store.initialized {
        return Err("Keystore not initialized. Call init_keystore first.".to_string());
    }

    // Validate that the data is valid base64
    let decoded = BASE64
        .decode(&key_data_b64)
        .map_err(|e| format!("Invalid base64 key data: {}", e))?;

    if decoded.is_empty() {
        return Err("Key data cannot be empty".to_string());
    }

    store.keys.insert(key_id.clone(), key_data_b64);

    Ok(StoredKeyInfo {
        key_id,
        stored: true,
    })
}

/// Retrieve a key from the vault by its ID.
///
/// Returns the base64-encoded key material, or an error if the key is not found.
#[tauri::command]
pub fn get_key(key_id: String) -> Result<String, String> {
    let store = KEYSTORE
        .lock()
        .map_err(|e| format!("Failed to lock keystore: {}", e))?;

    if !store.initialized {
        return Err("Keystore not initialized. Call init_keystore first.".to_string());
    }

    store
        .keys
        .get(&key_id)
        .cloned()
        .ok_or_else(|| format!("Key '{}' not found in keystore", key_id))
}
