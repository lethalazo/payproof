/**
 * Server-side AES-256-GCM encryption using the HTLC preimage as the key.
 * The preimage doubles as an encryption key — when the merchant reveals it
 * via claim(), the agent can decrypt the data.
 */

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Encrypt plaintext using AES-256-GCM with the preimage as the key.
 * Returns ciphertext, 12-byte random nonce, and 16-byte auth tag.
 */
export async function encrypt(
  plaintext: Uint8Array,
  preimageHex: string,
): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array; authTag: Uint8Array }> {
  const keyBytes = hexToBytes(preimageHex);

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );

  const nonce = new Uint8Array(12);
  crypto.getRandomValues(nonce);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, tagLength: 128 },
    key,
    plaintext,
  );

  const encryptedBytes = new Uint8Array(encrypted);
  // Web Crypto appends the 16-byte auth tag to the ciphertext
  const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - 16);
  const authTag = encryptedBytes.slice(encryptedBytes.length - 16);

  return { ciphertext, nonce, authTag };
}

/**
 * Compute SHA-256 hash of data, returned as 0x-prefixed hex string.
 */
export async function computeSHA256(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return "0x" + bytesToHex(new Uint8Array(hash));
}

export { hexToBytes, bytesToHex };
