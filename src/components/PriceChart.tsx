import { useEffect, useRef, useState } from "react";
import type { HistoryPoint } from "../lib/history";
import type { PricePoint } from "../lib/polymarket";
import { wadToNumber } from "../lib/units";
import type { Question } from "../near/aimm";

const H = 260;
const PAD = { l: 44, r: 12, t: 12, b: 28 };

/** One answer over time: AIMM's prediction range as a band, AIMM's price as a line, Polymarket's traded price as a
 * dashed line. The axis is zoomed to the data, so a band a few points wide is visible. AIMM's points are the contract's
 * state at past blocks; hovering shows the block. */
export function PriceChart({ q, points, selected, poly }: { q: Question; points: HistoryPoint[]; selected: number; poly: PricePoint[] | undefined }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setW(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (points.length < 2) return null;
  const t0 = points[0]!.time;
  const t1 = points[points.length - 1]!.time;
  const pct = (x: bigint | undefined) => wadToNumber(x ?? 0n) * 100;
  const rows = points.map((p) => ({ time: p.time, height: p.height, price: pct(p.prices[selected]), lo: pct(p.intervals[selected]?.[0]), hi: pct(p.intervals[selected]?.[1]) }));
  const pm = (poly ?? []).filter((p) => p.time >= t0 - 600_000 && p.time <= t1 + 600_000).map((p) => ({ time: Math.min(Math.max(p.time, t0), t1), price: p.price * 100 }));

  const values = [...rows.flatMap((r) => [r.lo, r.hi, r.price]), ...pm.map((p) => p.price)];
  const vmin = Math.min(...values);
  const vmax = Math.max(...values);
  const pad = Math.max(1, (vmax - vmin) * 0.12);
  const y0 = Math.max(0, Math.floor(vmin - pad));
  const y1 = Math.min(100, Math.ceil(vmax + pad));
  const x = (t: number) => PAD.l + ((t - t0) / Math.max(1, t1 - t0)) * (w - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - y0) / Math.max(1e-9, y1 - y0)) * (H - PAD.t - PAD.b);

  // AIMM's price only changes at a trade, so it is drawn in steps; so is the band
  const stepPath = (pts: { time: number; v: number }[]) => pts.map((p, k) => (k ? `H${x(p.time).toFixed(1)}V${y(p.v).toFixed(1)}` : `M${x(p.time).toFixed(1)},${y(p.v).toFixed(1)}`)).join("");
  // the band: along the top in steps, then back along the bottom, each step at the earlier reading's value
  const band =
    stepPath(rows.map((r) => ({ time: r.time, v: r.hi }))) +
    `V${y(rows[rows.length - 1]!.lo).toFixed(1)}` +
    rows
      .slice(0, -1)
      .reverse()
      .map((r) => `V${y(r.lo).toFixed(1)}H${x(r.time).toFixed(1)}`)
      .join("") +
    "Z";
  const last = rows[rows.length - 1]!;
  const nowWidth = last.hi - last.lo;
  const ticks = Array.from({ length: 5 }, (_, i) => y0 + ((y1 - y0) * i) / 4);
  const xTicks = [0, 1 / 3, 2 / 3, 1].map((f) => t0 + f * (t1 - t0));
  const fmtTime = (t: number) =>
    new Date(t).toLocaleString("en-US", t1 - t0 > 36 * 3_600_000 ? { month: "short", day: "numeric", hour: "numeric" } : { hour: "numeric", minute: "2-digit" });

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * w;
    let best = 0;
    rows.forEach((p, k) => {
      if (Math.abs(x(p.time) - px) < Math.abs(x(rows[best]!.time) - px)) best = k;
    });
    setHover(best);
  };
  const hp = hover === null ? null : rows[hover]!;
  const pmAt = (t: number) => {
    let v: number | null = null;
    for (const p of pm) if (p.time <= t) v = p.price;
    return v;
  };

  return (
    <div className="card card-pad">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <div style={{ fontWeight: 700 }}>
          {q.answers[selected]} <span className="faint small" style={{ fontWeight: 400 }}>· pick another answer below</span>
        </div>
        <div className="legend">
          <span>
            <span className="swatch" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent)" }} />
            Prediction range{nowWidth >= 0.05 ? `, now ${nowWidth.toFixed(1)} pt wide` : ", now the price itself"}
          </span>
          <span>
            <span className="swatch line" style={{ background: "var(--accent)" }} />
            Amuma
          </span>
          {pm.length > 0 && (
            <span>
              <span className="swatch line" style={{ background: "none", borderTop: "2px dashed var(--poly)", height: 0 }} />
              Polymarket midpoint
            </span>
          )}
        </div>
      </div>
      <div className="chart-wrap" ref={box}>
        <svg
          width="100%"
          height={H}
          viewBox={`0 0 ${w} ${H}`}
          role="img"
          aria-label={`${q.answers[selected]}: Amuma's price and prediction range${pm.length ? " and Polymarket's price" : ""} over time`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          style={{ display: "block", touchAction: "pan-y" }}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={w - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
              <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--ink-3)">
                {v.toFixed(y1 - y0 < 8 ? 1 : 0)}%
              </text>
            </g>
          ))}
          {xTicks.map((t, k) => (
            <text key={k} x={x(t)} y={H - 8} textAnchor={k === 0 ? "start" : k === 3 ? "end" : "middle"} fontSize={11} fill="var(--ink-3)">
              {fmtTime(t)}
            </text>
          ))}
          <path d={band} fill="var(--accent-soft)" stroke="var(--accent)" strokeOpacity={0.35} strokeWidth={1} />
          {pm.length > 1 && (
            <path
              d={pm.map((p, k) => `${k ? "L" : "M"}${x(p.time).toFixed(1)},${y(p.price).toFixed(1)}`).join("")}
              fill="none"
              stroke="var(--poly)"
              strokeWidth={1.75}
              strokeDasharray="5 4"
            />
          )}
          <path d={stepPath(rows.map((r) => ({ time: r.time, v: r.price })))} fill="none" stroke="var(--accent)" strokeWidth={2.25} strokeLinejoin="round" />
          {hp && (
            <g>
              <line x1={x(hp.time)} x2={x(hp.time)} y1={PAD.t} y2={H - PAD.b} stroke="var(--ink-3)" strokeDasharray="3 3" />
              <circle cx={x(hp.time)} cy={y(hp.price)} r={4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
            </g>
          )}
        </svg>
        {hp && (
          <div className="chart-tip num" style={{ left: Math.min(Math.max(0, (x(hp.time) / w) * 100 - 10), 60) + "%", top: 8 }}>
            <div className="faint" style={{ marginBottom: 4 }}>
              {new Date(hp.time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · block {hp.height.toLocaleString("en-US")}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span>Amuma</span>
              <span>{hp.price.toFixed(1)}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span>Range</span>
              <span>{hp.hi - hp.lo < 0.05 ? "the price" : `${hp.lo.toFixed(1)} – ${hp.hi.toFixed(1)}%`}</span>
            </div>
            {pmAt(hp.time) !== null && (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, color: "var(--poly)" }}>
                <span>Polymarket</span>
                <span>{pmAt(hp.time)!.toFixed(1)}%</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
