import { useNow, useQuestions, useTokenMeta } from "../hooks/data";
import { cityOf, splitTitle, timeLeft } from "../lib/format";
import { formatPercent, formatUnits } from "../lib/units";
import { phaseOf, type Question } from "../near/aimm";

export function Home() {
  const questions = useQuestions();
  const now = useNow(30_000);
  const all = (questions.data ?? []).filter((q) => q.opened && cityOf(q.title));
  const live = all.filter((q) => phaseOf(q, now) === "trading");
  // past questions: the live ones, and the replays run with the arbitrage bot; earlier test runs share titles with
  // them, so each title shows once, its latest run
  const seen = new Set<string>();
  const rest = all
    .filter((q) => phaseOf(q, now) !== "trading")
    .filter((q) => !splitTitle(q.title).replay || /arbitrage bot/.test(q.title))
    .filter((q) => !seen.has(q.title) && !!seen.add(q.title));

  return (
    <>
      <section className="hero">
        <div className="eyebrow">Adaptive Information Market Maker</div>
        <h1>Trade tomorrow's high in New York and London</h1>
        <p>
          Each question is backed by $1,000 and priced as deep as a $3,333 market. Next to every price, AIMM publishes its
          information interval: how far that price can be trusted, given what the pot can pay.
        </p>
      </section>

      <h2 className="section-title">Trading now</h2>
      {questions.isPending ? (
        <div className="grid">
          <div className="card skeleton" style={{ height: 210 }} />
          <div className="card skeleton" style={{ height: 210 }} />
        </div>
      ) : questions.isError ? (
        <div className="card empty">Could not reach NEAR testnet. It will retry on its own.</div>
      ) : live.length === 0 ? (
        <div className="card empty">No question is trading right now. A new day opens when Polymarket lists it.</div>
      ) : (
        <div className="grid">
          {live.map((q) => (
            <MarketCard key={q.id} q={q} now={now} />
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <>
          <h2 className="section-title">Closed and settled</h2>
          <div className="grid">
            {rest.map((q) => (
              <MarketCard key={q.id} q={q} now={now} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function MarketCard({ q, now }: { q: Question; now: number }) {
  const meta = useTokenMeta(q.collateral);
  const phase = phaseOf(q, now);
  const { title, replay } = splitTitle(q.title);
  const top = q.prices
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (b.p > a.p ? 1 : b.p < a.p ? -1 : 0))
    .slice(0, 3);
  const d = meta.data?.decimals ?? 6;

  return (
    <a className="card market-card" href={`#/q/${q.id}`}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span className="eyebrow">{cityOf(q.title)}</span>
        {phase === "trading" ? (
          <span className="pill live">Closes in {timeLeft(q.closeTime - now)}</span>
        ) : phase === "resolved" ? (
          <span className="pill">Settled</span>
        ) : (
          <span className="pill warn">Awaiting result</span>
        )}
      </div>
      <h3>{title}</h3>
      {phase === "resolved" && q.winner !== null ? (
        <div className="small">
          Won by <strong>{q.answers[q.winner]}</strong>, paid {formatUnits((q.payouts[q.winner] ?? 0n) / 10n ** 12n, 6)} per token
        </div>
      ) : (
        <div className="stack" style={{ gap: 6 }}>
          {top.map(({ p, i }) => (
            <div className="mini-row" key={i}>
              <span className="muted">{q.answers[i]}</span>
              <span className="mini-bar">
                <span style={{ width: `${Number(p / 10n ** 14n) / 100}%` }} />
              </span>
              <span className="num" style={{ textAlign: "right", fontWeight: 650 }}>
                {formatPercent(p, 0)}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="card-foot">
        <span className="muted">
          Backed by ${formatUnits(q.fund, d, 0)} · depth ${formatUnits(q.virtualLiquidity, d, 0)}
        </span>
        {replay && <span className="pill">Replay</span>}
      </div>
    </a>
  );
}
