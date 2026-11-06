import { useRef, useState } from "react";
import { AIMM_CONTRACT, EXPLORER_URL } from "../config";
import { useHistory, useNow, usePolymarket, useQuestion, useTokenMeta } from "../hooks/data";
import { cityOf, dateTime, splitTitle, timeLeft } from "../lib/format";
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
  const [side, setSide] = useState<Side>("buy");
  const panel = useRef<HTMLElement>(null);

  if (question.isError) return <div className="card empty">There is no question {id} on {AIMM_CONTRACT}, or testnet is out of reach.</div>;
  if (!q || !meta.data) return <div className="card skeleton" style={{ height: 420 }} />;

  const phase = phaseOf(q, now);
  const { title, replay } = splitTitle(q.title);
  const { decimals, symbol } = meta.data;
  // the answer shown first: the winner once there is one, else the likeliest
  const leader = q.winner ?? q.prices.reduce((best, p, i) => (p > (q.prices[best] ?? 0n) ? i : best), 0);
  const selection = picked ?? { range: leader, yes: true };
  const slug = slugFor(q.title, q.closeTime);
  // on a phone the form sits below the answers, so picking one brings the form into view
  const pick = (s: Selection, to: Side) => {
    setPicked(s);
    setSide(to);
    if (window.matchMedia("(max-width: 960px)").matches) panel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const sell = (s: Selection) => pick(s, "sell");

  return (
    <>
      <a href="#/" className="small">
        ← All markets
      </a>
      <div className="market-layout" style={{ marginTop: 12 }}>
        <div className="stack" style={{ gap: 16 }}>
          <div className="market-head">
            <div className="eyebrow">{cityOf(q.title)} · daily high</div>
            <h1>{title}</h1>
            <div className="head-meta">
              {phase === "trading" && <span className="pill live">Closes in {timeLeft(q.closeTime - now)}</span>}
              {phase === "closed" && <span className="pill warn">Closed, waiting for the result</span>}
              {phase === "resolved" && <span className="pill">Settled: {q.winner !== null ? q.answers[q.winner] : ""}</span>}
              {replay && <span className="pill">Replay of Polymarket's trades, with an arbitrage bot</span>}
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
          ) : history.isError ? (
            <div className="card card-pad small faint">The price history could not be read from the archival node just now; it will try again.</div>
          ) : history.data && history.data.length > 1 ? (
            <PriceChart q={q} points={history.data} selected={selection.range} />
          ) : null}

          <Ladder q={q} phase={phase} poly={poly.data} selected={selection} onSelect={(s) => pick(s, "buy")} />

          <div className="card card-pad small muted stack" style={{ gap: 8 }}>
            <div style={{ fontWeight: 700, color: "var(--ink)" }}>How AIMM prices this question</div>
            <div>
              The operator put up {meta.data && `$${(Number(q.fund) / 10 ** decimals).toLocaleString()}`}, yet the curve prices as deep as a $
              {(Number(q.virtualLiquidity) / 10 ** decimals).toLocaleString(undefined, { maximumFractionDigits: 0 })} market, so trades move the
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
