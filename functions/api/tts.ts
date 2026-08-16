import {
  bump,
  corsHeaders,
  originAllowed,
  preflight,
  today,
  upstreamCode,
  type QuotaEnv,
} from './_shared';

interface Env extends QuotaEnv {
  ELEVENLABS_VOICE_ID?: string;
}

const MAX_CHARS = 300;
const PER_IP_DAILY = 40;
const GLOBAL_DAILY = 2000;

/**
 * The readback voice. A voice ID is not a secret — it identifies a voice, it
 * does not grant access to it — so it lives in the repo and the app works with
 * no configuration beyond the API key. Override per-deployment with
 * ELEVENLABS_VOICE_ID if you want a different one.
 */
const DEFAULT_VOICE_ID = 'LI283TzJcIwSKqsXiH7u';

export const onRequestOptions: PagesFunction<Env> = async ({ request, env }) =>
  preflight(request, env);

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const origin = request.headers.get('Origin') ?? '';
  if (!originAllowed(origin, env)) return new Response('Forbidden', { status: 403 });

  if (!env.ELEVENLABS_API_KEY) {
    // No key configured: tell the client to downgrade, don't pretend.
    return new Response('Voice not configured', { status: 503 });
  }

  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const text = (body.text ?? '').trim().slice(0, MAX_CHARS);
  if (!text) return new Response('Empty text', { status: 400 });

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const day = today();

  if (!(await bump(env.QUOTA, `g:${day}`, GLOBAL_DAILY)))
    return new Response('Daily limit reached', { status: 429 });
  if (!(await bump(env.QUOTA, `ip:${ip}:${day}`, PER_IP_DAILY)))
    return new Response('Rate limited', { status: 429 });

  const voiceId = env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

  let upstream: Response;
  try {
    upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_flash_v2_5',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );
  } catch {
    return new Response('Upstream unreachable', { status: 502 });
  }

  if (!upstream.ok) {
    // The status is logged so a misconfigured key or voice can be diagnosed
    // from `wrangler pages deployment tail`. The body is never logged and
    // never returned: it can carry account detail.
    console.log(
      `tts upstream ${upstream.status} voice=${voiceId} code=${await upstreamCode(upstream)}`
    );
    // Pass quota signals through so the client downgrades for the right reason.
    const status = upstream.status;
    return new Response('Upstream error', {
      status: status === 429 || status === 402 ? status : 502,
    });
  }

  return new Response(upstream.body, {
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'audio/mpeg',
    },
  });
};
