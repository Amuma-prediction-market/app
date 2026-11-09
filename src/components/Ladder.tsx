import { formatCents, formatPercent, WAD, wadToNumber } from "../lib/units";
import type { Phase, Question } from "../near/aimm";

export interface Selection {
  range: number;
  yes: boolean;
}

/** An interval narrower than this is the price itself, to the precision shown. */
const POINT = 0.0005;

/** Every answer of the question: its price, its information interval and Polymarket's price as numbers, and a YES and a
 * NO to buy. Clicking an answer charts it. */
export function Ladder({
  q,
  phase,
  poly,
  selected,
  onSelect,
}: {
  q: Question;
  phase: Phase;
  poly: (number | null)[] | null | undefined;
  selected: Selection;
  onSelect: (s: Selection) => void;
}) {
  const resolved = phase === "resolved";
  const trading = phase === "trading";
  return (
    <div className="card">
      <div className="ladder-head">
        <span>Answer</span>
        <span style={{ textAlign: "right" }}>AIMM</span>
        <span title="How far the price can be trusted, given what the pot can pay">Interval</span>
        <span>{poly ? "Polymarket" : ""}</span>
        <span />
        <span />
      </div>
      {q.answers.map((answer, i) => {
        const price = q.prices[i] ?? 0n;
        const [lo, hi] = q.intervals[i] ?? [price, price];
        const width = wadToNumber(hi - lo);
        const p = poly?.[i];
        const gap = p != null ? (p - wadToNumber(price)) * 100 : null;
        const won = resolved && q.winner === i;
        const cls = ["ladder-row", selected.range === i && !resolved ? "selected" : "", won ? "won" : "", resolved && !won ? "lost" : ""].join(" ");
        return (
          <div className={cls} key={answer}>
            <button className="answer-label" onClick={() => onSelect({ range: i, yes: selected.yes })} title="Chart this answer">
              {answer}
              {won && (
                <span className="pill live" style={{ marginLeft: 8 }}>
                  Won
                </span>
              )}
            </button>
            <span className="price-big num">{resolved ? (won ? "100%" : "0%") : formatPercent(price)}</span>
            {resolved || !q.prices.length ? (
              <span className="small faint">{won ? "Winners redeem" : ""}</span>
            ) : width < POINT ? (
              <span className="small faint">Fully backed</span>
            ) : (
              <span className="interval-text num">
                {formatPercent(lo)} – {formatPercent(hi)}
                <span className="tiny"> {(width * 100).toFixed(1)} pt wide</span>
              </span>
            )}
            <span className="poly-text num small">
              {p != null && !resolved ? (
                <>
                  {(p * 100).toFixed(1)}%
                  {gap !== null && Math.abs(gap) >= 0.05 && <span className="faint"> {gap > 0 ? "+" : "−"}{Math.abs(gap).toFixed(1)}</span>}
                </>
              ) : null}
            </span>
            <button
              className={`side-btn yes ${selected.range === i && selected.yes && trading ? "active" : ""}`}
              disabled={!trading}
              onClick={() => onSelect({ range: i, yes: true })}
              aria-label={`Buy yes on ${answer}`}
            >
              Yes{trading ? ` ${formatCents(price)}` : ""}
            </button>
            <button
              className={`side-btn no ${selected.range === i && !selected.yes && trading ? "active" : ""}`}
              disabled={!trading}
              onClick={() => onSelect({ range: i, yes: false })}
              aria-label={`Buy no on ${answer}`}
            >
              No{trading ? ` ${formatCents(WAD - price)}` : ""}
            </button>
          </div>
        );
      })}
    </div>
  );
}
