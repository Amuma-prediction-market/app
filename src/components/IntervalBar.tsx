import { formatPercent, wadToNumber } from "../lib/units";

/** One answer's price on a 0–100% track, with its information interval as a band and Polymarket's price as a ring.
 * When the pot can pay every winner, the interval is the price itself and the band shrinks to the tick. */
export function IntervalBar({ price, interval, poly }: { price: bigint; interval: [bigint, bigint]; poly?: number | null }) {
  const [lo, hi] = interval;
  const pct = (x: number) => `${Math.min(100, Math.max(0, x * 100))}%`;
  const width = wadToNumber(hi - lo);
  const label =
    width < 0.0005
      ? `Interval: the price itself, ${formatPercent(price)}, fully backed`
      : `Interval ${formatPercent(lo)} to ${formatPercent(hi)}; price ${formatPercent(price)}`;
  const aria = label + (poly != null ? `; Polymarket ${(poly * 100).toFixed(1)}%` : "");
  return (
    <div>
      <div className="ibar" role="img" aria-label={aria} title={aria}>
        <div className="track" />
        <div className="band" style={{ left: pct(wadToNumber(lo)), width: `max(2px, ${width * 100}%)` }} />
        <div className="tick" style={{ left: pct(wadToNumber(price)) }} />
        {poly != null && <div className="poly" style={{ left: pct(poly) }} />}
      </div>
      {width >= 0.0005 && (
        <div className="ibar-caption num">
          <span>{formatPercent(lo)}</span>
          <span>{formatPercent(hi)}</span>
        </div>
      )}
    </div>
  );
}
