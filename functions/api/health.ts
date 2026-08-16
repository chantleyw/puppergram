interface Env {
  ELEVENLABS_API_KEY?: string;
}

/**
 * Reports whether the server-side ElevenLabs key is configured. It never
 * reveals the key, its length, or any part of it — only a boolean. The client
 * uses this to pick a voice backend before the user presses anything.
 */
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  return new Response(
    JSON.stringify({ elevenlabs: Boolean(env.ELEVENLABS_API_KEY) }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }
  );
};
