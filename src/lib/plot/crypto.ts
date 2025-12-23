/**
 * Encryption utilities for Plot Token Store
 *
 * Provides secure encryption/decryption for API keys stored in the token cache.
 * Uses AES-256-GCM for authenticated encryption.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

const ALGORITHM = "aes-256-gcm";
const SALT = "plot-token-salt";

/**
 * Get the encryption key from environment.
 * Uses PLOT_TOKEN_SECRET if available, otherwise falls back to JWT_SECRET.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.PLOT_TOKEN_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("PLOT_TOKEN_SECRET or JWT_SECRET must be configured");
  }
  return scryptSync(secret, SALT, 32);
}

/**
 * Encrypt an API key for secure storage.
 * Returns format: iv:authTag:encryptedData (all hex encoded)
 *
 * @param apiKey - The plaintext API key to encrypt
 * @returns Encrypted string in format "iv:authTag:encrypted"
 */
export function encryptApiKey(apiKey: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(apiKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt an API key from storage.
 *
 * @param encryptedKey - The encrypted string in format "iv:authTag:encrypted"
 * @returns The decrypted plaintext API key
 * @throws Error if decryption fails or format is invalid
 */
export function decryptApiKey(encryptedKey: string): string {
  const parts = encryptedKey.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted key format");
  }

  const [ivHex, authTagHex, encryptedData] = parts;
  if (!ivHex || !authTagHex || !encryptedData) {
    throw new Error("Invalid encrypted key format");
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Check if a string appears to be an encrypted API key.
 * Used to detect if migration is needed for old plaintext keys.
 *
 * @param value - The string to check
 * @returns true if it appears to be encrypted (has iv:authTag:data format)
 */
export function isEncryptedApiKey(value: string): boolean {
  const parts = value.split(":");
  if (parts.length !== 3) {
    return false;
  }
  // Check if all parts are valid hex strings of expected lengths
  const [ivHex, authTagHex, encryptedData] = parts;
  return (
    ivHex.length === 32 && // 16 bytes = 32 hex chars
    authTagHex.length === 32 && // 16 bytes = 32 hex chars
    encryptedData.length > 0 &&
    /^[a-f0-9]+$/i.test(ivHex) &&
    /^[a-f0-9]+$/i.test(authTagHex) &&
    /^[a-f0-9]+$/i.test(encryptedData)
  );
}


