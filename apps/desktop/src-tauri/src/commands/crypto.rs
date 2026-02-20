use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chacha20poly1305::{
    aead::{Aead, KeyInit},
    ChaCha20Poly1305, Nonce,
};
use ed25519_dalek::SigningKey;
use hkdf::Hkdf;
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use x25519_dalek::{PublicKey, StaticSecret};

#[derive(Debug, Serialize, Deserialize)]
pub struct KeyPair {
    /// X25519 public key for key exchange (base64)
    pub x25519_public: String,
    /// X25519 private key for key exchange (base64)
    pub x25519_private: String,
    /// Ed25519 public key for signing (base64)
    pub ed25519_public: String,
    /// Ed25519 private key for signing (base64)
    pub ed25519_private: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EncryptedPayload {
    /// Base64-encoded ciphertext
    pub ciphertext: String,
    /// Base64-encoded nonce (12 bytes)
    pub nonce: String,
}

/// Generate a new X25519 + Ed25519 keypair for encryption and signing.
#[tauri::command]
pub fn generate_keypair() -> Result<KeyPair, String> {
    // Generate X25519 keypair for Diffie-Hellman key exchange
    let x25519_secret = StaticSecret::random_from_rng(OsRng);
    let x25519_public = PublicKey::from(&x25519_secret);

    // Generate Ed25519 keypair for digital signatures
    let ed25519_signing = SigningKey::generate(&mut OsRng);
    let ed25519_verifying = ed25519_signing.verifying_key();

    Ok(KeyPair {
        x25519_public: BASE64.encode(x25519_public.as_bytes()),
        x25519_private: BASE64.encode(x25519_secret.to_bytes()),
        ed25519_public: BASE64.encode(ed25519_verifying.as_bytes()),
        ed25519_private: BASE64.encode(ed25519_signing.to_bytes()),
    })
}

/// Encrypt a plaintext message using ChaCha20-Poly1305.
///
/// `key_b64` must be a 32-byte key encoded as base64.
/// Returns the ciphertext and nonce, both base64-encoded.
#[tauri::command]
pub fn encrypt_message(plaintext: String, key_b64: String) -> Result<EncryptedPayload, String> {
    let key_bytes = BASE64
        .decode(&key_b64)
        .map_err(|e| format!("Invalid base64 key: {}", e))?;

    if key_bytes.len() != 32 {
        return Err(format!(
            "Key must be 32 bytes, got {}",
            key_bytes.len()
        ));
    }

    let cipher = ChaCha20Poly1305::new_from_slice(&key_bytes)
        .map_err(|e| format!("Failed to create cipher: {}", e))?;

    // Generate a random 12-byte nonce
    let mut nonce_bytes = [0u8; 12];
    use rand::RngCore;
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;

    Ok(EncryptedPayload {
        ciphertext: BASE64.encode(&ciphertext),
        nonce: BASE64.encode(nonce_bytes),
    })
}

/// Decrypt a ciphertext using ChaCha20-Poly1305.
///
/// `key_b64` must be a 32-byte key encoded as base64.
/// `ciphertext_b64` is the base64-encoded ciphertext.
/// `nonce_b64` is the base64-encoded 12-byte nonce.
#[tauri::command]
pub fn decrypt_message(
    ciphertext_b64: String,
    nonce_b64: String,
    key_b64: String,
) -> Result<String, String> {
    let key_bytes = BASE64
        .decode(&key_b64)
        .map_err(|e| format!("Invalid base64 key: {}", e))?;

    if key_bytes.len() != 32 {
        return Err(format!(
            "Key must be 32 bytes, got {}",
            key_bytes.len()
        ));
    }

    let ciphertext = BASE64
        .decode(&ciphertext_b64)
        .map_err(|e| format!("Invalid base64 ciphertext: {}", e))?;

    let nonce_bytes = BASE64
        .decode(&nonce_b64)
        .map_err(|e| format!("Invalid base64 nonce: {}", e))?;

    if nonce_bytes.len() != 12 {
        return Err(format!(
            "Nonce must be 12 bytes, got {}",
            nonce_bytes.len()
        ));
    }

    let cipher = ChaCha20Poly1305::new_from_slice(&key_bytes)
        .map_err(|e| format!("Failed to create cipher: {}", e))?;

    let nonce = Nonce::from_slice(&nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| format!("Decryption failed: {}", e))?;

    String::from_utf8(plaintext).map_err(|e| format!("Invalid UTF-8 in decrypted message: {}", e))
}

/// Derive a shared secret from a local X25519 private key and a remote X25519 public key
/// using ECDH, then expand it with HKDF-SHA256 to produce a 32-byte symmetric key.
///
/// Both keys are expected as base64-encoded 32-byte values.
#[tauri::command]
pub fn derive_shared_secret(
    private_key_b64: String,
    public_key_b64: String,
) -> Result<String, String> {
    let private_bytes = BASE64
        .decode(&private_key_b64)
        .map_err(|e| format!("Invalid base64 private key: {}", e))?;

    let public_bytes = BASE64
        .decode(&public_key_b64)
        .map_err(|e| format!("Invalid base64 public key: {}", e))?;

    if private_bytes.len() != 32 {
        return Err(format!(
            "Private key must be 32 bytes, got {}",
            private_bytes.len()
        ));
    }
    if public_bytes.len() != 32 {
        return Err(format!(
            "Public key must be 32 bytes, got {}",
            public_bytes.len()
        ));
    }

    let mut private_arr = [0u8; 32];
    private_arr.copy_from_slice(&private_bytes);
    let secret = StaticSecret::from(private_arr);

    let mut public_arr = [0u8; 32];
    public_arr.copy_from_slice(&public_bytes);
    let their_public = PublicKey::from(public_arr);

    // Perform X25519 ECDH
    let shared_secret = secret.diffie_hellman(&their_public);

    // Derive a symmetric key using HKDF-SHA256
    let hk = Hkdf::<Sha256>::new(None, shared_secret.as_bytes());
    let mut derived_key = [0u8; 32];
    hk.expand(b"zeusix-e2ee-v1", &mut derived_key)
        .map_err(|e| format!("HKDF expansion failed: {}", e))?;

    Ok(BASE64.encode(derived_key))
}
