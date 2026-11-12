import { formatCents, formatPercent, WAD, wadToNumber } from "../lib/units";
import type { PolyQuote } from "../lib/polymarket";
import type { Phase, Question } from "../near/aimm";

export interface Selection {
  range: number;
  yes: boolean;
}

/** An interval narrower than this is the price itself, to the precision shown. */
const POINT = 0.0005;

/** Every answer of the question: its price, its prediction range and Polymarket's price as numbers, and a YES and a
 * NO to buy. Clicking an answer charts it. */
export function Ladder({
  q,
  phase,
  poly,
  selected,
  onSelect,
  onChart,
}: {
  q: Question;
  phase: Phase;
  poly: (PolyQuote | null)[] | null | undefined;
  selected: Selection;
  onSelect: (s: Selection) => void;
  /** Clicking an answer's name: charts it, and leaves the trade form as it is. */
  onChart: (s: Selection) => void;
}) {
  const resolved = phase === "resolved";
  const trading = phase === "trading";
  return (
    <div className="card">
      <div className="ladder-head">
        <span>Answer</span>
        <span style={{ textAlign: "right" }}>Amuma</span>
        <span title="How far the price can be trusted, given what the pot can pay">Range</span>
        <span title="Polymarket's best bid and ask; Amuma inside them matches Polymarket">{poly ? "Polymarket bid–ask" : ""}</span>
        <span />
        <span />
      </div>
      {q.answers.map((answer, i) => {
        const price = q.prices[i] ?? 0n;
        const [lo, hi] = q.intervals[i] ?? [price, price];
        const width = wadToNumber(hi - lo);
        const quote = poly?.[i] ?? null;
        const won = resolved && q.winner === i;
        const cls = ["ladder-row", selected.range === i && !resolved ? "selected" : "", won ? "won" : "", resolved && !won ? "lost" : ""].join(" ");
        return (
          <div className={cls} key={answer}>
            <button className="answer-label" onClick={() => onChart({ range: i, yes: selected.yes })} title="Chart this answer">
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
                {/* a phone hides the column heads, so each cell carries its own */}
                <span className="cell-label">Range</span>
                {formatPercent(lo)} – {formatPercent(hi)}
                <span className="tiny"> {(width * 100).toFixed(1)} pt wide</span>
              </span>
            )}
            <span className="poly-text num small">
              {quote && !resolved ? (
                <>
                  <span className="cell-label">Polymarket</span>
                  <PolyCell quote={quote} aimm={wadToNumber(price)} />
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

/** Polymarket's bid-ask range beside AIMM's price. AIMM inside the range matches Polymarket: no one can buy on one and
 * sell on the other at a profit. Only a price outside it gets a number, how far outside. Where Polymarket shows no
 * range, its single price and the gap to AIMM's are shown instead. */
function PolyCell({ quote, aimm }: { quote: PolyQuote; aimm: number }) {
  const pct = (x: number) => (x * 100).toFixed(1);
  if (quote.ask == null && quote.bid == null) {
    const gap = (quote.mid - aimm) * 100;
    return (
      <>
        {pct(quote.mid)}%{Math.abs(gap) >= 0.05 && <span className="faint"> {gap > 0 ? "+" : "−"}{Math.abs(gap).toFixed(1)}</span>}
      </>
    );
  }
  const lo = quote.bid ?? 0;
  const hi = quote.ask ?? 1;
  const off = aimm < lo ? (aimm - lo) * 100 : aimm > hi ? (aimm - hi) * 100 : 0;
  return (
    <span title={`Polymarket: bid ${pct(lo)}%, ask ${pct(hi)}%`}>
      {pct(lo)}–{pct(hi)}%
      {Math.abs(off) >= 0.05 && <span className="faint"> Amuma {off > 0 ? "+" : "−"}{Math.abs(off).toFixed(1)} outside</span>}
    </span>
  );
}
