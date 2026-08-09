const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const ENCRYPTED_WEB_FORMAT = "mytischtennis-web-results-encrypted";
export const ENCRYPTED_WEB_VERSION = 1;
export const DEFAULT_PBKDF2_ITERATIONS = 310000;

function requirePassword(password) {
  if (typeof password !== "string" || password.length < 12) {
    throw new Error("Das Passwort muss mindestens 12 Zeichen lang sein.");
  }
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function deriveKey(password, salt, iterations) {
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return globalThis.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptJson(payload, password, iterations = DEFAULT_PBKDF2_ITERATIONS) {
  requirePassword(password);
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iterations);
  const encodedPayload = textEncoder.encode(JSON.stringify(payload));
  const ciphertext = await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encodedPayload);
  return {
    format: ENCRYPTED_WEB_FORMAT,
    version: ENCRYPTED_WEB_VERSION,
    cipher: "AES-256-GCM",
    kdf: "PBKDF2-SHA-256",
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptJson(encrypted, password) {
  requirePassword(password);
  if (
    !encrypted
    || encrypted.format !== ENCRYPTED_WEB_FORMAT
    || encrypted.version !== ENCRYPTED_WEB_VERSION
    || encrypted.cipher !== "AES-256-GCM"
    || encrypted.kdf !== "PBKDF2-SHA-256"
    || !Number.isInteger(encrypted.iterations)
    || !encrypted.salt
    || !encrypted.iv
    || !encrypted.ciphertext
  ) throw new Error("Die verschlüsselte Datei hat kein unterstütztes Format.");

  try {
    const salt = base64ToBytes(encrypted.salt);
    const iv = base64ToBytes(encrypted.iv);
    const ciphertext = base64ToBytes(encrypted.ciphertext);
    const key = await deriveKey(password, salt, encrypted.iterations);
    const plaintext = await globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return JSON.parse(textDecoder.decode(plaintext));
  } catch {
    throw new Error("Passwort oder verschlüsselte Datei ist ungültig.");
  }
}
