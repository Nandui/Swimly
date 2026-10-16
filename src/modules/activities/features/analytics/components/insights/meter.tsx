const whole = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

/** A small bar for a percentage in a table cell, with the figure. */
export function Meter({ value, tone }: { value: number | null; tone?: "warn" }) {
  if (value === null) return <span className="ins-muted">—</span>;
  return <span className="ins-meter" data-tone={tone}>
    <span className="ins-bar-track" aria-hidden="true"><span className="ins-bar-fill" style={{ width: `${Math.min(100, value)}%` }} /></span>
    <span className="ins-num">{`${whole.format(value)}%`}</span>
  </span>;
}

