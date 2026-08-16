/**
 * Shared guards for the two proxy endpoints.
 *
 * The origin check and the per-IP counter are speed bumps, not controls. The
 * real ceilings are the global daily cap here and the hard monthly credit cap
 * set on the ElevenLabs key itself.
 */

export interface QuotaEnv {
  ELEVENLABS_API_KEY: string;
  QUOTA: KVNamespace;
  /** Optional comma-separated override, set in the Pages dashboard. */
  ALLOWED_ORIGINS?: string;
}

const DEFAULT_ORIGINS = [
  'https://puppergram.pages.dev',
  'http://localhost:5173',
  'http://localhost:8788',
];

/** Cloudflare Pages preview deployments get a hashed subdomain. */
const PREVIEW_HOST = /^https:\/\/[a-z0-9-]+\.puppergram\.pages\.dev$/;

export function originAllowed(origin: string, env: QuotaEnv): boolean {
  if (!origin) return false;
  const configured = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_ORIGINS;
  return configured.includes(origin) || PREVIEW_HOST.test(origin);
}

/**
 * ElevenLabs errors look like `{"detail":{"status":"voice_not_found",...}}`.
 * Returns just that slug for the logs — a machine-readable cause such as
 * `voice_not_found` or `missing_permissions`. The human-readable message and
 * the rest of the body are deliberately dropped, since they can carry account
 * detail, and neither is ever returned to the client.
 */
export async function upstreamCode(res: Response): Promise<string> {
  try {
    const body = (await res.clone().json()) as {
      detail?: { status?: string } | string;
    };
    const detail = body?.detail;
    if (typeof detail === 'string') return detail.slice(0, 120);
    if (detail?.status) return detail.status;
  } catch {
    /* not JSON — fall through */
  }
  // Auth failures are the one case where the body might describe the account,
  // so those never get quoted, even in a log.
  if (res.status === 401 || res.status === 403) return 'auth';
  try {
    return (await res.clone().text()).replace(/\s+/g, ' ').slice(0, 160);
  } catch {
    return 'unreadable';
  }
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Increments a daily counter, returning false once the limit is reached.
 * Not transactional — KV has no compare-and-swap — but a few races at the
 * boundary do not matter for a spend ceiling.
 */
export async function bump(
  kv: KVNamespace,
  key: string,
  limit: number
): Promise<boolean> {
  const raw = await kv.get(key);
  const n = raw ? parseInt(raw, 10) : 0;
  if (Number.isNaN(n) || n >= limit) return n < limit;
  await kv.put(key, String(n + 1), { expirationTtl: 60 * 60 * 26 });
  return true;
}

export function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
  };
}

export function preflight(request: Request, env: QuotaEnv): Response {
  const origin = request.headers.get('Origin') ?? '';
  if (!originAllowed(origin, env)) return new Response('Forbidden', { status: 403 });
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(origin),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
