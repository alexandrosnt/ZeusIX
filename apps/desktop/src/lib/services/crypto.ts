/**
 * Crypto service - bridges to Tauri IPC commands for E2EE operations.
 * When running in browser (dev mode), falls back to Web Crypto API.
 */

interface KeyPair {
	publicKey: string; // base64
	privateKey: string; // base64
}

interface EncryptedPayload {
	ciphertext: string; // base64
	nonce: string; // base64
}

// Check if running inside Tauri
function isTauri(): boolean {
	return typeof window !== 'undefined' && '__TAURI__' in window;
}

export async function generateKeyPair(): Promise<KeyPair> {
	if (isTauri()) {
		const { invoke } = await import('@tauri-apps/api/core');
		return invoke<KeyPair>('generate_keypair');
	}

	// Web Crypto fallback for development
	const key = await crypto.subtle.generateKey({ name: 'X25519' } as any, true, [
		'deriveBits'
	]);
	return {
		publicKey: btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('raw', (key as any).publicKey)))),
		privateKey: btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('pkcs8', (key as any).privateKey))))
	};
}

export async function encryptMessage(
	plaintext: string,
	sharedSecret: string
): Promise<EncryptedPayload> {
	if (isTauri()) {
		const { invoke } = await import('@tauri-apps/api/core');
		return invoke<EncryptedPayload>('encrypt_message', {
			plaintext,
			key: sharedSecret
		});
	}

	// Web Crypto AES-GCM fallback for development
	const encoder = new TextEncoder();
	const data = encoder.encode(plaintext);
	const nonce = crypto.getRandomValues(new Uint8Array(12));
	const keyBytes = Uint8Array.from(atob(sharedSecret), (c) => c.charCodeAt(0));
	const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, [
		'encrypt'
	]);
	const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cryptoKey, data);

	return {
		ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
		nonce: btoa(String.fromCharCode(...nonce))
	};
}

export async function decryptMessage(
	ciphertext: string,
	nonce: string,
	sharedSecret: string
): Promise<string> {
	if (isTauri()) {
		const { invoke } = await import('@tauri-apps/api/core');
		return invoke<string>('decrypt_message', {
			ciphertext,
			nonce,
			key: sharedSecret
		});
	}

	// Web Crypto AES-GCM fallback
	const data = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
	const iv = Uint8Array.from(atob(nonce), (c) => c.charCodeAt(0));
	const keyBytes = Uint8Array.from(atob(sharedSecret), (c) => c.charCodeAt(0));
	const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, [
		'decrypt'
	]);
	const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, data);

	return new TextDecoder().decode(decrypted);
}

export async function initKeystore(password: string): Promise<void> {
	if (isTauri()) {
		const { invoke } = await import('@tauri-apps/api/core');
		return invoke('init_keystore', { password });
	}
	// No-op in browser
}
