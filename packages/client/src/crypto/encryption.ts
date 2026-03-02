/**
 * Client-side AES-256-GCM decryption using the HTLC preimage as the key.
 * After the merchant claims (revealing the preimage on-chain), the agent
 * reads the preimage from the Claimed event and decrypts the data.
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
 * Decrypt ciphertext using AES-256-GCM with the preimage as the key.
 * Web Crypto expects the auth tag appended to the ciphertext.
 */
export async function decrypt(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  authTag: Uint8Array,
  preimageHex: string,
): Promise<Uint8Array> {
  const keyBytes = hexToBytes(preimageHex);

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );

  // Web Crypto expects ciphertext + authTag concatenated
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext, 0);
  combined.set(authTag, ciphertext.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce, tagLength: 128 },
    key,
    combined,
  );

  return new Uint8Array(decrypted);
}

/**
 * Compute SHA-256 hash of data, returned as 0x-prefixed hex string.
 */
export async function computeSHA256(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return "0x" + bytesToHex(new Uint8Array(hash));
}

export { hexToBytes, bytesToHex };
