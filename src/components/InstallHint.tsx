import { useEffect, useState } from 'react';

const DISMISS_KEY = 'puppergram.install.dismissed.v1';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIosSafari() {
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);
  const webkit = /WebKit/.test(ua);
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return iOS && webkit && !otherBrowser;
}

/**
 * The whelping box is usually in an outbuilding with no signal, so installing
 * matters more here than in most apps. Android and desktop get the real
 * prompt; iOS has no programmatic install, so it gets instructions instead.
 */
export function InstallHint() {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === '1'
  );

  useEffect(() => {
    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
    }
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (dismissed || isStandalone()) return null;

  const ios = isIosSafari();
  if (!deferred && !ios) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  }

  return (
    <div className="card no-print flex items-start gap-3 border-heat/25 bg-heat/5 px-4 py-3">
      <span aria-hidden className="mt-0.5 text-heat">
        ⤓
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-cream">Install Puppergram</p>
        <p className="mt-0.5 text-xs leading-snug text-muted">
          {ios
            ? 'Tap Share, then "Add to Home Screen". It then works with no signal, which matters in an outbuilding.'
            : 'Runs offline and opens straight from your home screen or Start menu.'}
        </p>

        {deferred && (
          <button
            type="button"
            onClick={async () => {
              await deferred.prompt();
              await deferred.userChoice;
              setDeferred(null);
            }}
            className="tap mt-2 rounded-lg bg-heat px-4 py-2 text-sm font-semibold text-ink"
          >
            Install
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install hint"
        className="tap -mr-2 -mt-1 px-2 text-muted hover:text-cream"
      >
        ✕
      </button>
    </div>
  );
}
