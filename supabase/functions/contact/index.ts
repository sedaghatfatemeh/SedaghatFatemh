import { createClient } from 'npm:@supabase/supabase-js@2';
import { createCorsHeaders, assertAllowedOrigin, HttpError } from '../_shared/cors.ts';
import { jsonResponse } from '../_shared/http.ts';
import { parseContactPayload } from '../_shared/validation.ts';
import { getClientIp, sha256Hex, truncateUtf8 } from '../_shared/security.ts';

const allowedOrigins = new Set([
  'https://sedaghatfatemeh.github.io',
  'http://127.0.0.1:5500',
  'http://localhost:5500',
]);
const RATE_LIMIT_REQUESTS = 5;
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

function createAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const rawKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (!supabaseUrl || !rawKeys) throw new Error('Supabase runtime secrets are unavailable.');

  const secretKeys = JSON.parse(rawKeys) as Record<string, string>;
  const secretKey = secretKeys.default ?? Object.values(secretKeys)[0];
  if (!secretKey) throw new Error('No Supabase secret key is configured for the function runtime.');

  return createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();
  const corsHeaders = createCorsHeaders(request, { allowedOrigins });

  if (request.method === 'OPTIONS') {
    const origin = request.headers.get('origin') ?? '';
    return new Response(null, { status: allowedOrigins.has(origin) ? 204 : 403, headers: corsHeaders });
  }

  try {
    assertAllowedOrigin(request, allowedOrigins);
    if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Only POST is supported.', { Allow: 'POST, OPTIONS' });

    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'unsupported_media_type', 'Content-Type must be application/json.');

    const contentLength = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(contentLength) && contentLength > 20_000) throw new HttpError(413, 'payload_too_large', 'Request body is too large.');

    let rawBody: unknown;
    try { rawBody = await request.json(); } catch { throw new HttpError(400, 'invalid_json', 'Request body is not valid JSON.'); }
    const payload = parseContactPayload(rawBody);

    if (payload.website) return jsonResponse({ ok: true, data: { accepted: true }, requestId }, 202, corsHeaders);

    const supabaseAdmin = createAdminClient();
    const ipHash = await sha256Hex(getClientIp(request));
    const bucketKey = await sha256Hex(`contact:${ipHash}`);

    const { data: rateData, error: rateError } = await supabaseAdmin.rpc('consume_contact_rate_limit', {
      p_bucket_key: bucketKey,
      p_limit: RATE_LIMIT_REQUESTS,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    });

    if (rateError) {
      console.error(JSON.stringify({ level: 'error', event: 'contact_rate_limit_failed', requestId, error: rateError.message }));
      throw new HttpError(503, 'temporary_unavailable', 'Service temporarily unavailable.');
    }

    const rate = Array.isArray(rateData) ? rateData[0] : rateData;
    if (!rate?.allowed) {
      throw new HttpError(429, 'rate_limited', 'Too many requests. Please try again later.', {
        'Retry-After': String(rate?.retry_after_seconds ?? 900),
        'X-RateLimit-Limit': String(RATE_LIMIT_REQUESTS),
        'X-RateLimit-Remaining': '0',
      });
    }

    const { error: insertError } = await supabaseAdmin.from('contact_messages').insert({
      name: payload.name,
      email: payload.email,
      subject: payload.subject,
      message: payload.message,
      locale: payload.locale,
      source: 'landing',
      user_agent: truncateUtf8(request.headers.get('user-agent'), 500),
      ip_hash: ipHash,
      request_id: requestId,
    });

    if (insertError) {
      console.error(JSON.stringify({ level: 'error', event: 'contact_insert_failed', requestId, error: insertError.message }));
      throw new HttpError(500, 'contact_store_failed', 'Message could not be stored.');
    }

    const responseHeaders = new Headers(corsHeaders);
    responseHeaders.set('X-RateLimit-Remaining', String(rate?.remaining ?? 0));
    return jsonResponse({ ok: true, data: { accepted: true }, requestId }, 201, responseHeaders);
  } catch (error) {
    const httpError = error instanceof HttpError ? error : new HttpError(500, 'internal_error', 'Unexpected server error.');
    if (!(error instanceof HttpError)) console.error(JSON.stringify({ level: 'error', event: 'contact_unhandled_error', requestId, error: error instanceof Error ? error.message : String(error) }));
    const headers = new Headers(corsHeaders);
    if (httpError.headers) for (const [key, value] of new Headers(httpError.headers)) headers.set(key, value);
    return jsonResponse({ ok: false, error: { code: httpError.code, message: httpError.message, requestId } }, httpError.status, headers);
  }
});
