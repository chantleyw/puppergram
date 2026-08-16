import { useEffect, useRef, useState } from 'react';

/**
 * The number rolls when it changes. This is one of only two animations in the
 * app, and it exists because a changing weight is the single event the user
 * came here for.
 */
export function RollingNumber({
  value,
  className = '',
  suffix,
}: {
  value: number;
  className?: string;
  suffix?: string;
}) {
  const previous = useRef(value);
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    if (previous.current !== value) {
      previous.current = value;
      setRolling(true);
      const t = setTimeout(() => setRolling(false), 240);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <span className={`inline-block overflow-hidden ${className}`}>
      <span className={rolling ? 'inline-block animate-roll' : 'inline-block'}>
        {value}
        {suffix && <span className="ml-0.5 text-[0.6em] text-muted">{suffix}</span>}
      </span>
    </span>
  );
}
