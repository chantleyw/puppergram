import { useCallback, useEffect, useRef, useState } from 'react';
import { startListening, type Listener } from '../lib/voice';

type State = 'idle' | 'listening' | 'thinking';

/**
 * Hold to talk. Press and hold is the right gesture here: the user has one
 * hand on a puppy, and a press-to-start / press-to-stop toggle leaves the mic
 * open when they inevitably forget the second press.
 */
export function VoiceButton({
  onTranscript,
  onError,
  disabled,
  hint = 'Hold to speak',
}: {
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const [state, setState] = useState<State>('idle');
  const listener = useRef<Listener | null>(null);
  const holding = useRef(false);

  useEffect(() => {
    return () => listener.current?.cancel();
  }, []);

  const begin = useCallback(async () => {
    if (disabled || holding.current) return;
    holding.current = true;
    setState('listening');
    const l = await startListening({
      onTranscript: (t) => onTranscript(t),
      onError: (m) => {
        setState('idle');
        onError(m);
      },
      onStateChange: (s) => setState(s),
    });
    listener.current = l;
    // The user may have released before the mic finished opening.
    if (!holding.current) l.stop();
  }, [disabled, onTranscript, onError]);

  const end = useCallback(() => {
    if (!holding.current) return;
    holding.current = false;
    listener.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    holding.current = false;
    listener.current?.cancel();
    setState('idle');
  }, []);

  const label =
    state === 'listening'
      ? 'Listening — release to send'
      : state === 'thinking'
        ? 'Working…'
        : hint;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        disabled={disabled || state === 'thinking'}
        aria-label={hint}
        aria-pressed={state === 'listening'}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          void begin();
        }}
        onPointerUp={end}
        onPointerCancel={cancel}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
            e.preventDefault();
            void begin();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            end();
          }
        }}
        className={`tap flex h-[72px] w-full max-w-[420px] select-none items-center justify-center gap-3 rounded-2xl border-2 text-base font-semibold transition-colors ${
          state === 'listening'
            ? 'border-heat bg-heat text-ink'
            : 'border-heat/50 bg-heat/10 text-heat active:bg-heat/20'
        } disabled:opacity-40`}
        style={{ touchAction: 'none' }}
      >
        <span aria-hidden className="text-xl leading-none">
          {state === 'thinking' ? '◌' : '🎙'}
        </span>
        <span>{label}</span>
      </button>

      <p className="text-center text-xs text-muted" aria-live="polite">
        {state === 'listening'
          ? 'Say the collar colour, then the weight'
          : 'e.g. "blue, two forty five"'}
      </p>
    </div>
  );
}
