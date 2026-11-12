import { useRef, useState } from "react";
import { AIMM_CONTRACT, EXPLORER_URL } from "../config";
import { useHistory, useNow, usePolymarket, usePolymarketHistory, useQuestion, useTokenMeta } from "../hooks/data";
import { cityOfTitle, dateTime, splitTitle, timeLeft } from "../lib/format";
import { formatUnits } from "../lib/units";
import { slugFor } from "../lib/polymarket";
import { phaseOf } from "../near/aimm";
import { Ladder, type Selection } from "./Ladder";
import { Position } from "./Position";
import { PriceChart } from "./PriceChart";
import { Stats } from "./Stats";
import { TradePanel, type Side } from "./TradePanel";

export function MarketPage({ id }: { id: number }) {
  const question = useQuestion(id);
  const q = question.data;
  const meta = useTokenMeta(q?.collateral);
  const poly = usePolymarket(q);
  const history = useHistory(q);
  const now = useNow();
  const [picked, setPicked] = useState<Selection | null>(null);
  // the answer shown first: the winner once there is one, else the likeliest
  const leader = q ? (q.winner ?? q.prices.reduce((best, p, i) => (p > (q.prices[best] ?? 0n) ? i : best), 0)) : 0;
  const selection = picked ?? { range: leader, yes: true };
  const span = history.data && history.data.length > 1 ? history.data : null;
  const polyHistory = usePolymarketHistory(q, selection.range, span?.[0]?.time, span?.[span.length - 1]?.time);
  const [side, setSide] = useState<Side>("buy");
  const panel = useRef<HTMLElement>(null);

  // a failed refetch keeps the question it had; only a question never read at all gets this card
  if (question.isError && !q) return <div className="card empty">There is no question {id} on {AIMM_CONTRACT}, or testnet is out of reach.</div>;
  if (!q || !meta.data) return <div className="card skeleton" style={{ height: 420 }} />;

  const phase = phaseOf(q, now);
  const { title, replay } = splitTitle(q.title);
  const city = cityOfTitle(q.title);
  const { decimals, symbol } = meta.data;
  const slug = slugFor(q.title, q.closeTime);
  // on a phone the form sits below the answers, so picking one brings the form into view (the width matches the
  // one-column layout in styles.css)
  const pick = (s: Selection, to: Side) => {
    setPicked(s);
    setSide(to);
    if (window.matchMedia("(max-width: 1080px)").matches) panel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const sell = (s: Selection) => pick(s, "sell");

  return (
    <>
      <a href={city ? `#/${city.slug}` : "#/"} className="small">
        ← {city ? `All ${city.name} questions` : "Choose a city"}
      </a>
      <div className="market-layout" style={{ marginTop: 12 }}>
        <div className="stack" style={{ gap: 16 }}>
          <div className="market-head">
            <div className="eyebrow">Daily high</div>
            <h1>{title}</h1>
            <div className="head-meta">
              {phase === "trading" && <span className="pill live">Closes in {timeLeft(q.closeTime - now)}</span>}
              {phase === "closed" && <span className="pill warn">Closed, waiting for the result</span>}
              {phase === "halted" && <span className="pill warn">Stopped early, waiting for the result</span>}
              {phase === "resolved" && <span className="pill">Settled: {q.winner !== null ? q.answers[q.winner] : ""}</span>}
              {replay && <span className="pill">Replay of Polymarket's trades, with an arbitrageur</span>}
              <span>Closes {dateTime(q.closeTime)}</span>
              {slug && (
                <a href={`https://polymarket.com/event/${slug}`} target="_blank" rel="noreferrer">
                  Same question on Polymarket ↗
                </a>
              )}
            </div>
          </div>

          <Stats q={q} decimals={decimals} symbol={symbol} />

          {history.isPending && q.opened ? (
            <div className="card card-pad small faint">Reading the price history from past blocks…</div>
          ) : history.isError && !history.data ? (
            <div className="card card-pad small faint">The price history could not be read from the archival node just now; it will try again.</div>
          ) : history.data && history.data.length > 1 ? (
            <PriceChart q={q} points={history.data} selected={selection.range} poly={polyHistory.data} />
          ) : null}

          {/* Polymarket's quotes stop updating once trading here closes, so they show only while it trades */}
          <Ladder
            q={q}
            phase={phase}
            poly={phase === "trading" ? poly.data : undefined}
            selected={selection}
            onSelect={(s) => pick(s, "buy")}
            onChart={setPicked}
          />

          <div className="card card-pad small muted stack" style={{ gap: 8 }}>
            <div style={{ fontWeight: 700, color: "var(--ink)" }}>How Amuma prices this question</div>
            <div>
              The operator put up ${formatUnits(q.fund, decimals, 0)}, yet the curve prices as deep as a ${formatUnits(q.virtualLiquidity, decimals, 0)}{" "}
              market, so trades move the
              price less. Every winning token is paid min(1, pot ÷ winning tokens): in full while the pot covers the winners, and an equal share if it
              ever does not.
            </div>
            <div>
              The <strong>information interval</strong> beside each price is what the price tells you once that payout is taken into account. While
              the pot covers every answer it is the price itself; when it does not, it widens to show how far the price can be trusted. A trader who
              believes the chance is above the interval buys Yes; below it, No.
            </div>
            <div className="faint">
              Resolved by {q.resolver} with Polymarket's result after the close. Contract{" "}
              <a href={`${EXPLORER_URL}/address/${AIMM_CONTRACT}`} target="_blank" rel="noreferrer">
                {AIMM_CONTRACT}
              </a>
              , question {q.id}.
            </div>
          </div>
        </div>

        <aside className="aside" ref={panel} style={{ scrollMarginTop: 72 }}>
          <TradePanel
            q={q}
            phase={phase}
            selection={selection}
            onSelection={setPicked}
            side={side}
            onSide={setSide}
            decimals={decimals}
            symbol={symbol}
          />
          <Position q={q} phase={phase} decimals={decimals} symbol={symbol} onSell={sell} />
        </aside>
      </div>
    </>
  );
}
