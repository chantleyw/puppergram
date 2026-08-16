/**
 * Transcription backend resolution, in three layers:
 *
 *   1. ElevenLabs Scribe, through our own Pages Function, using the
 *      server-side key. No key entry field exists anywhere in the UI.
 *   2. The Web Speech API, whenever the proxy is absent, out of quota, or
 *      failing. This is a silent downgrade, never an error.
 *   3. The manual keypad, which is always on screen regardless.
 *
 * Any non-200 from the proxy means "downgrade and continue".
 *
 * This governs speech-to-text only. Readback is always the browser's own
 * synthesis — see the note further down.
 */

export type Backend = 'elevenlabs' | 'browser' | 'none';

let backend: Backend | null = null;
const listeners = new Set<(b: Backend) => void>();

function notify() {
  if (backend) for (const l of listeners) l(backend);
}

export function onBackendChange(fn: (b: Backend) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function currentBackend(): Backend | null {
  return backend;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

function recognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | SpeechRecognitionCtor
    | null;
}

/** The browser fallback for transcription needs recognition, not synthesis. */
function browserCapable() {
  return recognitionCtor() !== null;
}

export async function resolveBackend(): Promise<Backend> {
  if (backend) return backend;
  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      const { elevenlabs } = (await res.json()) as { elevenlabs?: boolean };
      if (elevenlabs) {
        backend = 'elevenlabs';
        notify();
        return backend;
      }
    }
  } catch {
    // fall through to the browser backend
  }
  backend = browserCapable() ? 'browser' : 'none';
  notify();
  return backend;
}

export function demoteToBrowser() {
  backend = browserCapable() ? 'browser' : 'none';
  notify();
}

export function backendLabel(b: Backend | null): string {
  if (b === 'elevenlabs') return 'ElevenLabs';
  if (b === 'browser') return 'browser';
  if (b === 'none') return 'unavailable';
  return 'checking';
}

/* ================================================================== */
/* Output — spoken readback                                            */
/* ================================================================== */

/**
 * Readback uses the browser's own speech synthesis, deliberately.
 *
 * Transcription is the half where quality decides whether the feature works
 * at all: mishearing "two forty five" as "240" writes a wrong weight into a
 * medical record. Reading a line back is a solved problem that every browser
 * already does offline and for free, so spending an API call — and a network
 * round trip, at 3am, in a shed with no signal — buys nothing.
 */

export function stopSpeaking() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

export function canSpeak(): boolean {
  return 'speechSynthesis' in window;
}

export function speak(text: string): Promise<void> {
  const trimmed = text.trim();
  return new Promise((resolve) => {
    if (!trimmed || !('speechSynthesis' in window)) return resolve();
    stopSpeaking();
    const u = new SpeechSynthesisUtterance(trimmed);
    // Calm and unhurried: this plays at 3am in a dim room.
    u.rate = 0.95;
    u.pitch = 0.95;
    u.volume = 1;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

/* ================================================================== */
/* Input — speech to text                                              */
/* ================================================================== */

export interface Listener {
  stop(): void;
  cancel(): void;
}

export interface ListenCallbacks {
  onTranscript(text: string): void;
  onError(message: string): void;
  onStateChange?(state: 'listening' | 'thinking' | 'idle'): void;
}

function pickMimeType(): string | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4', // Safari / iOS
    'audio/ogg;codecs=opus',
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported?.(t));
}

async function listenWithElevenLabs(cb: ListenCallbacks): Promise<Listener> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    cb.onError('Microphone unavailable. Use the keypad.');
    return { stop() {}, cancel() {} };
  }

  const mimeType = pickMimeType();
  const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];
  let cancelled = false;

  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  rec.onstop = async () => {
    for (const track of stream.getTracks()) track.stop();
    if (cancelled) {
      cb.onStateChange?.('idle');
      return;
    }
    cb.onStateChange?.('thinking');
    const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
    if (blob.size === 0) {
      cb.onError('Nothing recorded. Hold the button while you speak.');
      cb.onStateChange?.('idle');
      return;
    }
    try {
      const form = new FormData();
      const ext = (rec.mimeType || 'audio/webm').includes('mp4') ? 'mp4' : 'webm';
      form.append('audio', blob, `clip.${ext}`);
      const res = await fetch('/api/stt', { method: 'POST', body: form });
      if (!res.ok) {
        demoteToBrowser();
        cb.onError('Voice service unavailable — switched to the browser.');
        cb.onStateChange?.('idle');
        return;
      }
      const { text } = (await res.json()) as { text?: string };
      cb.onTranscript(text ?? '');
    } catch {
      demoteToBrowser();
      cb.onError('Voice service unreachable — switched to the browser.');
    } finally {
      cb.onStateChange?.('idle');
    }
  };

  rec.start();
  cb.onStateChange?.('listening');

  return {
    stop() {
      if (rec.state !== 'inactive') rec.stop();
    },
    cancel() {
      cancelled = true;
      if (rec.state !== 'inactive') rec.stop();
    },
  };
}

function listenWithBrowser(cb: ListenCallbacks): Listener {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    cb.onError('Voice input is not available on this browser. Use the keypad.');
    return { stop() {}, cancel() {} };
  }
  const rec = new Ctor();
  rec.lang = navigator.language || 'en-GB';
  rec.continuous = false;
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  let cancelled = false;
  let got = false;

  rec.onresult = (e) => {
    got = true;
    const text = e.results?.[0]?.[0]?.transcript ?? '';
    if (!cancelled) cb.onTranscript(text);
  };
  rec.onerror = (e) => {
    if (cancelled) return;
    cb.onError(
      e.error === 'not-allowed'
        ? 'Microphone permission denied. Use the keypad.'
        : 'Did not catch that. Try again, or use the keypad.'
    );
  };
  rec.onend = () => {
    cb.onStateChange?.('idle');
    if (!got && !cancelled) {
      cb.onError('Nothing heard. Hold the button while you speak.');
    }
  };

  try {
    rec.start();
    cb.onStateChange?.('listening');
  } catch {
    cb.onError('Could not start listening. Use the keypad.');
  }

  return {
    stop() {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    },
    cancel() {
      cancelled = true;
      try {
        rec.abort();
      } catch {
        /* already stopped */
      }
    },
  };
}

export async function startListening(cb: ListenCallbacks): Promise<Listener> {
  const b = await resolveBackend();
  if (b === 'elevenlabs') return listenWithElevenLabs(cb);
  if (b === 'browser') return listenWithBrowser(cb);
  cb.onError('Voice is unavailable here. Use the keypad.');
  return { stop() {}, cancel() {} };
}
