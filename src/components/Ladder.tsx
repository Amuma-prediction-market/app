import { IntervalBar } from "./IntervalBar";
import { formatCents, formatPercent, WAD } from "../lib/units";
import type { Phase, Question } from "../near/aimm";

export interface Selection {
  range: number;
  yes: boolean;
}

/** Every answer of the question: its price, its information interval, and a YES and a NO to buy. */
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
        <span style={{ textAlign: "right" }}>Chance</span>
        <span className="legend">
          <span>
            <span className="swatch" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent)" }} />
            Information interval
          </span>
          {poly && (
            <span>
              <span className="swatch" style={{ border: "2px solid var(--poly)", borderRadius: "50%" }} />
              Polymarket
            </span>
          )}
        </span>
        <span />
        <span />
      </div>
      {q.answers.map((answer, i) => {
        const price = q.prices[i] ?? 0n;
        const won = resolved && q.winner === i;
        const cls = ["ladder-row", selected.range === i && trading ? "selected" : "", won ? "won" : "", resolved && !won ? "lost" : ""].join(" ");
        return (
          <div className={cls} key={answer}>
            <span className="answer-label">
              {answer}
              {won && (
                <span className="pill live" style={{ marginLeft: 8 }}>
                  Won
                </span>
              )}
            </span>
            <span className="price-big num">{resolved ? (won ? "100%" : "0%") : formatPercent(price)}</span>
            {resolved ? (
              <span className="small faint">{won ? "Winning tokens redeem at the payout" : ""}</span>
            ) : q.prices.length ? (
              <IntervalBar price={price} interval={q.intervals[i] ?? [price, price]} poly={poly?.[i]} />
            ) : (
              <span />
            )}
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
