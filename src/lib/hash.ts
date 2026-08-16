/**
 * SHA-256 over a UTF-8 string, returned as 64 lowercase hex characters.
 * Uses Web Crypto, which is available in every browser that can run this app
 * (it requires a secure context: https, or localhost during development).
 */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Grouped into 8-char blocks so a human can compare two digests by eye. */
export function prettyDigest(hex: string): string {
  return (hex.match(/.{1,8}/g) ?? []).join(' ');
}

export function shortDigest(hex: string): string {
  return `${hex.slice(0, 8)}…${hex.slice(-8)}`;
}
