export async function hash(value: string) {
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(buffer)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export function token() {
  return crypto.randomUUID() + crypto.randomUUID();
}
async function encryptionKey(secret: string) {
  if (secret.length < 32) throw new Error("ENCRYPTION_REQUIRED");
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function seal(value: unknown, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12)),
    key = await encryptionKey(secret);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return JSON.stringify({ iv: [...iv], data: [...new Uint8Array(encrypted)] });
}
export async function unseal<T>(payload: string, secret: string): Promise<T> {
  const p = JSON.parse(payload),
    key = await encryptionKey(secret);
  const result = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(p.iv) },
    key,
    new Uint8Array(p.data),
  );
  return JSON.parse(new TextDecoder().decode(result));
}
