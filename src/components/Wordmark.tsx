export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div>
      <p className="display text-xl leading-none text-cream">
        Puppergram
        <span className="ml-1.5 text-heat" aria-hidden>
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
