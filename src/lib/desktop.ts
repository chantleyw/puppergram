/**
 * Desktop-shell adjustments. The Tauri build runs the same web app in a
 * WebView2 window, so this file holds the two places that genuinely differ —
 * and nothing else. There is no desktop-only logic anywhere in the app.
 */

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Inside the app window, `target="_blank"` dead-ends: there is no tab to open.
 * Hand external links to the user's real browser instead — this is what
 * the Solana Explorer link on a sealed passport needs.
 */
export function installExternalLinkHandler(): () => void {
  if (!isDesktop()) return () => {};

  const onClick = (e: MouseEvent) => {
    const anchor = (e.target as HTMLElement | null)?.closest?.('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href') ?? '';
    if (!/^https?:\/\//i.test(href)) return;

    e.preventDefault();
    void (async () => {
      try {
        const { openUrl } = await import('@tauri-apps/plugin-opener');
        await openUrl(href);
      } catch {
        /* If the shell refuses, the link simply does nothing. */
      }
    })();
  };

  document.addEventListener('click', onClick);
  return () => document.removeEventListener('click', onClick);
}
