use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalMessage {
    pub id: String,
    pub channel_id: String,
    pub author_id: String,
    pub content: String,
    pub created_at: String,
    pub edited_at: Option<String>,
    pub nonce: Option<String>,
}

/// Initialize (or open) the local encrypted SQLite database.
///
/// `db_path` is the filesystem path for the database file.
/// `passphrase` is used as the SQLCipher encryption key.
#[tauri::command]
pub fn init_local_db(
    db_path: String,
    passphrase: String,
    _app: tauri::AppHandle,
) -> Result<String, String> {
    let conn =
        Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    // Set the SQLCipher encryption key
    // SQLCipher encryption key (only effective with bundled-sqlcipher feature)
    #[cfg(feature = "sqlcipher")]
    conn.pragma_update(None, "key", &passphrase)
        .map_err(|e| format!("Failed to set encryption key: {}", e))?;
    let _ = &passphrase; // suppress unused warning when sqlcipher is disabled

    // Create tables if they don't exist
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            channel_id TEXT NOT NULL,
            author_id TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            edited_at TEXT,
            nonce TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_messages_channel
            ON messages (channel_id, created_at);

        CREATE TABLE IF NOT EXISTS channels (
            id TEXT PRIMARY KEY,
            name TEXT,
            server_id TEXT,
            last_message_id TEXT,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS key_cache (
            channel_id TEXT PRIMARY KEY,
            encrypted_key BLOB NOT NULL,
            updated_at TEXT NOT NULL
        );
        ",
    )
    .map_err(|e| format!("Failed to create tables: {}", e))?;

    // Store the connection in managed state is not feasible here since we
    // need to return. Instead we use the app handle to manage state.
    // For simplicity, we store a success indicator and reopen as needed.
    // In production, you'd use tauri::Manager to manage the connection.

    Ok(format!("Database initialized at {}", db_path))
}

/// Store a decrypted message in the local encrypted database.
#[tauri::command]
pub fn store_message(
    db_path: String,
    passphrase: String,
    channel_id: String,
    author_id: String,
    content: String,
    nonce: Option<String>,
) -> Result<LocalMessage, String> {
    let conn =
        Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    // SQLCipher encryption key (only effective with bundled-sqlcipher feature)
    #[cfg(feature = "sqlcipher")]
    conn.pragma_update(None, "key", &passphrase)
        .map_err(|e| format!("Failed to set encryption key: {}", e))?;
    let _ = &passphrase; // suppress unused warning when sqlcipher is disabled

    let id = Uuid::new_v4().to_string();
    let created_at = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO messages (id, channel_id, author_id, content, created_at, nonce)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, channel_id, author_id, content, created_at, nonce],
    )
    .map_err(|e| format!("Failed to store message: {}", e))?;

    Ok(LocalMessage {
        id,
        channel_id,
        author_id,
        content,
        created_at,
        edited_at: None,
        nonce,
    })
}

/// Retrieve locally stored messages for a given channel.
///
/// `limit` controls the maximum number of messages returned (default 50).
/// `before` is an optional cursor timestamp for pagination (ISO 8601).
#[tauri::command]
pub fn get_messages(
    db_path: String,
    passphrase: String,
    channel_id: String,
    limit: Option<u32>,
    before: Option<String>,
) -> Result<Vec<LocalMessage>, String> {
    let conn =
        Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    // SQLCipher encryption key (only effective with bundled-sqlcipher feature)
    #[cfg(feature = "sqlcipher")]
    conn.pragma_update(None, "key", &passphrase)
        .map_err(|e| format!("Failed to set encryption key: {}", e))?;
    let _ = &passphrase; // suppress unused warning when sqlcipher is disabled

    let limit = limit.unwrap_or(50).min(200);

    let mut messages: Vec<LocalMessage> = Vec::new();

    if let Some(ref before_ts) = before {
        let mut stmt = conn
            .prepare(
                "SELECT id, channel_id, author_id, content, created_at, edited_at, nonce
                 FROM messages
                 WHERE channel_id = ?1 AND created_at < ?2
                 ORDER BY created_at DESC
                 LIMIT ?3",
            )
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let rows = stmt
            .query_map(params![channel_id, before_ts, limit], |row| {
                Ok(LocalMessage {
                    id: row.get(0)?,
                    channel_id: row.get(1)?,
                    author_id: row.get(2)?,
                    content: row.get(3)?,
                    created_at: row.get(4)?,
                    edited_at: row.get(5)?,
                    nonce: row.get(6)?,
                })
            })
            .map_err(|e| format!("Failed to query messages: {}", e))?;

        for row in rows {
            messages.push(row.map_err(|e| format!("Failed to read row: {}", e))?);
        }
    } else {
        let mut stmt = conn
            .prepare(
                "SELECT id, channel_id, author_id, content, created_at, edited_at, nonce
                 FROM messages
                 WHERE channel_id = ?1
                 ORDER BY created_at DESC
                 LIMIT ?2",
            )
            .map_err(|e| format!("Failed to prepare query: {}", e))?;

        let rows = stmt
            .query_map(params![channel_id, limit], |row| {
                Ok(LocalMessage {
                    id: row.get(0)?,
                    channel_id: row.get(1)?,
                    author_id: row.get(2)?,
                    content: row.get(3)?,
                    created_at: row.get(4)?,
                    edited_at: row.get(5)?,
                    nonce: row.get(6)?,
                })
            })
            .map_err(|e| format!("Failed to query messages: {}", e))?;

        for row in rows {
            messages.push(row.map_err(|e| format!("Failed to read row: {}", e))?);
        }
    }

    // Return in chronological order (oldest first)
    messages.reverse();

    Ok(messages)
}

/// Delete all locally stored messages, optionally filtered by channel.
///
/// If `channel_id` is provided, only messages in that channel are deleted.
/// If omitted, all messages across all channels are deleted.
#[tauri::command]
pub fn clear_messages(
    db_path: String,
    passphrase: String,
    channel_id: Option<String>,
) -> Result<u64, String> {
    let conn =
        Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    // SQLCipher encryption key (only effective with bundled-sqlcipher feature)
    #[cfg(feature = "sqlcipher")]
    conn.pragma_update(None, "key", &passphrase)
        .map_err(|e| format!("Failed to set encryption key: {}", e))?;
    let _ = &passphrase; // suppress unused warning when sqlcipher is disabled

    let rows_deleted = if let Some(ref cid) = channel_id {
        conn.execute("DELETE FROM messages WHERE channel_id = ?1", params![cid])
            .map_err(|e| format!("Failed to delete messages: {}", e))?
    } else {
        conn.execute("DELETE FROM messages", [])
            .map_err(|e| format!("Failed to delete messages: {}", e))?
    };

    Ok(rows_deleted as u64)
}
