import { useEffect, useMemo, useRef, useState } from "react";
import type { HistoryPoint } from "../lib/history";
import { wadToNumber } from "../lib/units";
import type { Question } from "../near/aimm";

const COLORS = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)"];
const H = 240;
const PAD = { l: 40, r: 12, t: 12, b: 28 };

/** The leading answers' prices over time, read from past blocks, with the selected answer's information interval
 * as a band. One axis, 0 to 100%. */
export function PriceChart({ q, points, selected }: { q: Question; points: HistoryPoint[]; selected: number }) {
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

  // the four answers priced highest at the last reading, the selected one always among them, in answer order so a
  // colour stays with its answer
  const series = useMemo(() => {
    const last = points[points.length - 1];
    if (!last) return [];
    const ranked = last.prices.map((p, i) => ({ p, i })).sort((a, b) => (b.p > a.p ? 1 : b.p < a.p ? -1 : 0)).map((x) => x.i);
    const pick = ranked.slice(0, 4);
    if (!pick.includes(selected)) pick[3] = selected;
    return pick.sort((a, b) => a - b);
  }, [points, selected]);

  if (points.length < 2) return null;
  const t0 = points[0]!.time;
  const t1 = points[points.length - 1]!.time;
  const x = (t: number) => PAD.l + ((t - t0) / Math.max(1, t1 - t0)) * (w - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v) * (H - PAD.t - PAD.b);
  const line = (i: number) => points.map((p, k) => `${k ? "L" : "M"}${x(p.time).toFixed(1)},${y(wadToNumber(p.prices[i] ?? 0n)).toFixed(1)}`).join("");
  const band =
    points.map((p, k) => `${k ? "L" : "M"}${x(p.time).toFixed(1)},${y(wadToNumber(p.intervals[selected]?.[1] ?? 0n)).toFixed(1)}`).join("") +
    [...points]
      .reverse()
      .map((p) => `L${x(p.time).toFixed(1)},${y(wadToNumber(p.intervals[selected]?.[0] ?? 0n)).toFixed(1)}`)
      .join("") +
    "Z";
  const widest = Math.max(...points.map((p) => wadToNumber((p.intervals[selected]?.[1] ?? 0n) - (p.intervals[selected]?.[0] ?? 0n))));
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const xTicks = [0, 1 / 3, 2 / 3, 1].map((f) => t0 + f * (t1 - t0));
  const fmtTime = (t: number) =>
    new Date(t).toLocaleString("en-US", t1 - t0 > 36 * 3_600_000 ? { month: "short", day: "numeric", hour: "numeric" } : { hour: "numeric", minute: "2-digit" });

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * w;
    let best = 0;
    points.forEach((p, k) => {
      if (Math.abs(x(p.time) - px) < Math.abs(x(points[best]!.time) - px)) best = k;
    });
    setHover(best);
  };
  const hp = hover === null ? null : points[hover]!;

  return (
    <div className="card card-pad">
      <div className="legend" style={{ marginBottom: 8 }}>
        {series.map((i, k) => (
          <span key={i}>
            <span className="swatch line" style={{ background: COLORS[k] }} />
            {q.answers[i]} <span className="num faint">{(wadToNumber(points[points.length - 1]!.prices[i] ?? 0n) * 100).toFixed(1)}%</span>
          </span>
        ))}
        {widest >= 0.0005 && (
          <span>
            <span className="swatch" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent)" }} />
            Interval of {q.answers[selected]}
          </span>
        )}
      </div>
      <div className="chart-wrap" ref={box}>
        <svg
          width="100%"
          height={H}
          viewBox={`0 0 ${w} ${H}`}
          role="img"
          aria-label={`Prices of ${series.map((i) => q.answers[i]).join(", ")} over time`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          style={{ display: "block", touchAction: "pan-y" }}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={w - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
              <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--ink-3)">
                {v * 100}%
              </text>
            </g>
          ))}
          {xTicks.map((t, k) => (
            <text key={k} x={x(t)} y={H - 8} textAnchor={k === 0 ? "start" : k === 3 ? "end" : "middle"} fontSize={11} fill="var(--ink-3)">
              {fmtTime(t)}
            </text>
          ))}
          {widest >= 0.0005 && <path d={band} fill="var(--accent-soft)" stroke="none" />}
          {series.map((i, k) => (
            <path key={i} d={line(i)} fill="none" stroke={COLORS[k]} strokeWidth={i === selected ? 2.5 : 2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {hp && (
            <g>
              <line x1={x(hp.time)} x2={x(hp.time)} y1={PAD.t} y2={H - PAD.b} stroke="var(--ink-3)" strokeDasharray="3 3" />
              {series.map((i, k) => (
                <circle key={i} cx={x(hp.time)} cy={y(wadToNumber(hp.prices[i] ?? 0n))} r={4} fill={COLORS[k]} stroke="var(--surface)" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
        {hp && (
          <div className="chart-tip" style={{ left: Math.min(Math.max(0, (x(hp.time) / w) * 100 - 10), 62) + "%", top: 8 }}>
            <div className="faint" style={{ marginBottom: 4 }}>
              {new Date(hp.time).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · block {hp.height.toLocaleString()}
            </div>
            {series.map((i, k) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>
                  <span className="swatch line" style={{ background: COLORS[k] }} />
                  {q.answers[i]}
                </span>
                <span className="num">{(wadToNumber(hp.prices[i] ?? 0n) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
