import { formatPercent, wadToNumber } from "../lib/units";

/** One answer's price on a 0–100% track, with its information interval as a band, and Polymarket's price as a marker
 * above the track so the two never cover each other. The numbers are written underneath: a gap of a point or two is
 * only a few pixels on the track. */
export function IntervalBar({ price, interval, poly }: { price: bigint; interval: [bigint, bigint]; poly?: number | null }) {
  const [lo, hi] = interval;
  const pct = (x: number) => `${Math.min(100, Math.max(0, x * 100))}%`;
  const width = wadToNumber(hi - lo);
  const point = width < 0.0005;
  const gap = poly != null ? (poly - wadToNumber(price)) * 100 : null;
  const label =
    (point
      ? `Interval: the price itself, ${formatPercent(price)}, fully backed`
      : `Interval ${formatPercent(lo)} to ${formatPercent(hi)}; price ${formatPercent(price)}`) +
    (poly != null ? `; Polymarket ${(poly * 100).toFixed(1)}%` : "");
  return (
    <div>
      <div className="ibar" role="img" aria-label={label} title={label}>
        <div className="track" />
        <div className="band" style={{ left: pct(wadToNumber(lo)), width: `max(2px, ${width * 100}%)` }} />
        <div className="tick" style={{ left: pct(wadToNumber(price)) }} />
        {poly != null && <div className="poly" style={{ left: pct(poly) }} />}
      </div>
      <div className="ibar-caption num">
        <span>{point ? "Fully backed" : `${formatPercent(lo)} – ${formatPercent(hi)}`}</span>
        {gap !== null && (
          <span className="poly-text">
            Polymarket {(poly! * 100).toFixed(1)}%{Math.abs(gap) >= 0.05 ? ` (${gap > 0 ? "+" : "−"}${Math.abs(gap).toFixed(1)})` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
