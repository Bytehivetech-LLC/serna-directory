import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM symmetric encryption for stored integration secrets.
 *
 * The 32-byte master key comes from SECRETS_ENCRYPTION_KEY (base64). We fail
 * loudly at module load if it's missing or the wrong length — a silently-weak
 * key is worse than a hard error. Ciphertext format is:
 *
 *   base64( iv(12) | authTag(16) | ciphertext )
 */

const IV_LEN = 12;
const TAG_LEN = 16;

function loadKey(): Buffer {
  const raw = process.env.SECRETS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "SECRETS_ENCRYPTION_KEY is not set. Generate one with `npm run generate:secret-key` and add it to the environment.",
    );
  }
  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64");
  } catch {
    throw new Error("SECRETS_ENCRYPTION_KEY must be base64.");
  }
  if (key.length !== 32) {
    throw new Error(
      `SECRETS_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}). Generate one with \`npm run generate:secret-key\`.`,
    );
  }
  return key;
}

// Validate at module load — any import fails fast if the key is wrong.
const KEY = loadKey();

/** Encrypt a plaintext secret → base64(iv | authTag | ciphertext). */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/** Decrypt base64(iv | authTag | ciphertext) → plaintext. Throws on tamper. */
export function decryptSecret(encoded: string): string {
  const buf = Buffer.from(encoded, "base64");
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error("Ciphertext too short.");
  }
  const iv = buf.subarray(0, IV_LEN);
  const authTag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/** A safe hint for the UI — the last 4 characters, never the whole secret. */
export function secretHint(plaintext: string): string {
  return plaintext.length <= 4 ? "••••" : `…${plaintext.slice(-4)}`;
}
