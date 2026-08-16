import {
  bump,
  corsHeaders,
  originAllowed,
  preflight,
  today,
  upstreamCode,
  type QuotaEnv,
} from './_shared';

const MAX_BYTES = 400_000;
const PER_IP_DAILY = 60;
const GLOBAL_DAILY = 1500;

/**
 * `scribe_v1` is deprecated; `scribe_v2` is the current transcription model.
 * Verified against the ElevenLabs docs at build time.
 */
const STT_MODEL = 'scribe_v2';

export const onRequestOptions: PagesFunction<QuotaEnv> = async ({ request, env }) =>
  preflight(request, env);

export const onRequestPost: PagesFunction<QuotaEnv> = async ({ request, env }) => {
  const origin = request.headers.get('Origin') ?? '';
  if (!originAllowed(origin, env)) return new Response('Forbidden', { status: 403 });

  if (!env.ELEVENLABS_API_KEY) {
    return new Response('Voice not configured', { status: 503 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const file = form.get('audio');
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES)
    return new Response('Bad audio', { status: 400 });

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const day = today();

  if (!(await bump(env.QUOTA, `sg:${day}`, GLOBAL_DAILY)))
    return new Response('Daily limit reached', { status: 429 });
  if (!(await bump(env.QUOTA, `sip:${ip}:${day}`, PER_IP_DAILY)))
    return new Response('Rate limited', { status: 429 });

  const upstreamForm = new FormData();
  upstreamForm.append('file', file);
  upstreamForm.append('model_id', STT_MODEL);
  // The app only ever needs the words, so ask for the cheapest useful shape.
  upstreamForm.append('diarize', 'false');
  upstreamForm.append('tag_audio_events', 'false');

  let upstream: Response;
  try {
    upstream = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY },
      body: upstreamForm,
    });
  } catch {
    return new Response('Upstream unreachable', { status: 502 });
  }

  if (!upstream.ok) {
    // Status only — never the body, which can carry account detail.
    console.log(
      `stt upstream ${upstream.status} model=${STT_MODEL} code=${await upstreamCode(upstream)}`
    );
    const status = upstream.status;
    return new Response('Upstream error', {
      status: status === 429 || status === 402 ? status : 502,
    });
  }

  const data = (await upstream.json()) as { text?: string };
  return new Response(JSON.stringify({ text: data.text ?? '' }), {
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json',
    },
  });
};
