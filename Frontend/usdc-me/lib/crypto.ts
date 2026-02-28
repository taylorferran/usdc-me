export interface EncryptedKeyBlob {
  ciphertext: string // base64
  iv: string // base64 (12 bytes for AES-GCM)
  salt: string // base64 (16 bytes for PBKDF2)
  version: 1
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  )

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 600_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  )
}

export async function encryptPrivateKey(
  privateKey: string,
  password: string
): Promise<EncryptedKeyBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)

  const encoder = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(privateKey)
  )

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...iv)),
    salt: btoa(String.fromCharCode(...salt)),
    version: 1,
  }
}

export async function decryptPrivateKey(
  blob: EncryptedKeyBlob,
  password: string
): Promise<string> {
  const salt = Uint8Array.from(atob(blob.salt), (c) => c.charCodeAt(0))
  const iv = Uint8Array.from(atob(blob.iv), (c) => c.charCodeAt(0))
  const ciphertext = Uint8Array.from(atob(blob.ciphertext), (c) => c.charCodeAt(0))

  const key = await deriveKey(password, salt)

  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext)

  return new TextDecoder().decode(decrypted)
}
