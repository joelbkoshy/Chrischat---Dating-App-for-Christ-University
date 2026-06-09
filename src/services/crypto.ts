import nacl from 'tweetnacl';
import {
  encodeBase64,
  decodeBase64,
  encodeUTF8,
  decodeUTF8,
} from 'tweetnacl-util';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const PRIVATE_KEY_STORAGE = 'e2ee_private_key';
const PUBLIC_KEY_STORAGE = 'e2ee_public_key';

let SecureStore: typeof import('expo-secure-store') | null = null;
if (Platform.OS !== 'web') {
  try {
    SecureStore = require('expo-secure-store');
  } catch {}
}

// --- Secure key storage (SecureStore on native, AsyncStorage on web) ---

async function storeKey(key: string, value: string): Promise<void> {
  if (SecureStore && Platform.OS !== 'web') {
    await SecureStore.setItemAsync(key, value);
  } else {
    await AsyncStorage.setItem(key, value);
  }
}

async function getKey(key: string): Promise<string | null> {
  if (SecureStore && Platform.OS !== 'web') {
    return SecureStore.getItemAsync(key);
  }
  return AsyncStorage.getItem(key);
}

// --- Key pair management ---

export async function generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  const keyPair = nacl.box.keyPair();
  const publicKey = encodeBase64(keyPair.publicKey);
  const privateKey = encodeBase64(keyPair.secretKey);

  await storeKey(PRIVATE_KEY_STORAGE, privateKey);
  await storeKey(PUBLIC_KEY_STORAGE, publicKey);

  return { publicKey, privateKey };
}

export async function getStoredKeyPair(): Promise<{ publicKey: string; privateKey: string } | null> {
  const privateKey = await getKey(PRIVATE_KEY_STORAGE);
  const publicKey = await getKey(PUBLIC_KEY_STORAGE);
  if (!privateKey || !publicKey) return null;
  return { publicKey, privateKey };
}

export async function getOrCreateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  const existing = await getStoredKeyPair();
  if (existing) return existing;
  return generateKeyPair();
}

// --- Encryption / Decryption ---

// Cache computed shared keys: peerPublicKey -> Uint8Array
const sharedKeyCache = new Map<string, Uint8Array>();

function getSharedKey(myPrivateKeyB64: string, peerPublicKeyB64: string): Uint8Array {
  const cacheKey = `${myPrivateKeyB64}:${peerPublicKeyB64}`;
  let shared = sharedKeyCache.get(cacheKey);
  if (!shared) {
    shared = nacl.box.before(
      decodeBase64(peerPublicKeyB64),
      decodeBase64(myPrivateKeyB64),
    );
    sharedKeyCache.set(cacheKey, shared);
  }
  return shared;
}

/**
 * Encrypt a plaintext message for a peer.
 * Returns a base64 string containing nonce + ciphertext.
 */
export function encryptMessage(
  plaintext: string,
  myPrivateKeyB64: string,
  peerPublicKeyB64: string,
): string {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageBytes = decodeUTF8(plaintext);
  const sharedKey = getSharedKey(myPrivateKeyB64, peerPublicKeyB64);
  const encrypted = nacl.box.after(messageBytes, nonce, sharedKey);
  if (!encrypted) throw new Error('Encryption failed');

  // Combine nonce + ciphertext into a single buffer
  const combined = new Uint8Array(nonce.length + encrypted.length);
  combined.set(nonce);
  combined.set(encrypted, nonce.length);

  return encodeBase64(combined);
}

/**
 * Decrypt an encrypted message from a peer.
 * Input is the base64 string containing nonce + ciphertext.
 */
export function decryptMessage(
  encryptedB64: string,
  myPrivateKeyB64: string,
  peerPublicKeyB64: string,
): string | null {
  try {
    const combined = decodeBase64(encryptedB64);
    const nonce = combined.slice(0, nacl.box.nonceLength);
    const ciphertext = combined.slice(nacl.box.nonceLength);
    const sharedKey = getSharedKey(myPrivateKeyB64, peerPublicKeyB64);
    const decrypted = nacl.box.open.after(ciphertext, nonce, sharedKey);
    if (!decrypted) return null; // Decryption failed (wrong key or tampered)
    return encodeUTF8(decrypted);
  } catch {
    return null;
  }
}

/**
 * Check if a message text looks like an encrypted E2EE payload.
 * Encrypted messages are base64 and start with at least nonceLength + 16 bytes.
 */
export function isEncrypted(text: string): boolean {
  if (!text || text.length < 44) return false; // min base64 for nonce + 1 byte
  try {
    const decoded = decodeBase64(text);
    return decoded.length > nacl.box.nonceLength;
  } catch {
    return false;
  }
}
