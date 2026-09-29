export function getClientIp(request: Request): string {
  const candidates = [
    request.headers.get('cf-connecting-ip'),
    request.headers.get('x-real-ip'),
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  ];
  return candidates.find((value): value is string => Boolean(value)) ?? 'unknown';
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function truncateUtf8(value: string | null, maxChars: number): string | null {
  if (!value) return null;
  return value.length <= maxChars ? value : value.slice(0, maxChars);
}
