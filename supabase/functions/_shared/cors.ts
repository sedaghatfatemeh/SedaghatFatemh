export type CorsPolicy = Readonly<{ allowedOrigins: ReadonlySet<string>; allowMethods?: string; allowHeaders?: string }>;

export class HttpError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly headers?: HeadersInit) {
    super(message);
    this.name = 'HttpError';
  }
}

export function createCorsHeaders(request: Request, policy: CorsPolicy): Headers {
  const origin = request.headers.get('origin') ?? '';
  const headers = new Headers({
    'Access-Control-Allow-Methods': policy.allowMethods ?? 'POST, OPTIONS',
    'Access-Control-Allow-Headers': policy.allowHeaders ?? 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  });
  if (origin && policy.allowedOrigins.has(origin)) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}

export function assertAllowedOrigin(request: Request, allowedOrigins: ReadonlySet<string>): void {
  const origin = request.headers.get('origin');
  if (!origin || !allowedOrigins.has(origin)) throw new HttpError(403, 'origin_not_allowed', 'Origin is not allowed.');
}
