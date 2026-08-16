export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div>
      <p className="display gradient-text text-xl leading-none">
        Puppergram
        <span className="ml-1.5" aria-hidden>
          ·
        </span>
      </p>
      {!compact && (
        <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-muted">
          Neonatal litter monitor
        </p>
      )}
    </div>
  );
}
