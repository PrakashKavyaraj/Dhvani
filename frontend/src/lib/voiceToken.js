const SALT_BYTES = 32;
const HEX_BYTES = Array.from({ length: 256 }, (_, value) => value.toString(16).padStart(2, '0'));

async function bytesToHex(bytes) {
  let value = '';
  for (const byte of bytes) value += HEX_BYTES[byte];
  return value;
}

/**
 * Produces a privacy-preserving, per-chunk token in the browser.
 *
 * A fresh random 256-bit salt is included for every invocation. Therefore,
 * the same audio chunk (including an empty chunk) produces a different
 * SHA-256 token each time. The raw chunk and salt are not persisted here.
 */
export async function createVoiceChunkToken(audioChunk = new ArrayBuffer(0)) {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error('Web Crypto is unavailable. Use HTTPS or localhost to generate voice tokens.');
  }

  const chunk = new Uint8Array(audioChunk);
  const payload = new Uint8Array(SALT_BYTES + chunk.byteLength);
  const salt = payload.subarray(0, SALT_BYTES);
  crypto.getRandomValues(salt);
  payload.set(chunk, SALT_BYTES);

  const digest = await crypto.subtle.digest('SHA-256', payload);
  return bytesToHex(new Uint8Array(digest));
}

/** Creates a session-only HMAC signature for an incident payload. */
export async function createIncidentHmac(payload) {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error('Web Crypto is unavailable. Use HTTPS or localhost to generate incident signatures.');
  }

  const keyBytes = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(JSON.stringify(payload)));
  return bytesToHex(new Uint8Array(signature));
}
