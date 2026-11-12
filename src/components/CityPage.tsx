import { useNow, useQuestions, useTokenMeta } from "../hooks/data";
import { CITIES, cityOfTitle, splitTitle, timeLeft, type City } from "../lib/format";
import { formatPercent, formatUnits } from "../lib/units";
import { phaseOf, type Question } from "../near/aimm";

/** One city's questions: the ones trading now, then the closed and settled ones. No other city's appear here; the
 * switch at the top moves to the other city. */
export function CityPage({ city }: { city: City }) {
  const questions = useQuestions();
  const now = useNow(30_000);
  const all = (questions.data ?? []).filter((q) => q.opened && cityOfTitle(q.title)?.slug === city.slug);
  const live = all.filter((q) => phaseOf(q, now) === "trading");
  // past questions: the live ones, and the replays run with the arbitrage bot; earlier test runs share titles with
  // them, so each title shows once, its latest run (a title trading now is already shown above)
  const seen = new Set<string>(live.map((q) => q.title));
  const rest = all
    .filter((q) => phaseOf(q, now) !== "trading")
    .filter((q) => !splitTitle(q.title).replay || /arbitrage bot/.test(q.title))
    .filter((q) => !seen.has(q.title) && !!seen.add(q.title));

  return (
    <>
      <section className="city-head">
        <CitySwitch current={city} />
        <h1>{city.name}</h1>
        <p>Daily high temperature. One question a day, with Polymarket's price beside every answer.</p>
      </section>

      <h2 className="section-title">Trading now</h2>
      {questions.isPending ? (
        <div className="grid">
          <div className="card skeleton" style={{ height: 230 }} />
        </div>
      ) : questions.isError && !questions.data ? (
        <div className="card empty">Could not reach NEAR testnet. It will retry on its own.</div>
      ) : live.length === 0 ? (
        <div className="card empty">Nothing is trading in {city.name} right now. The next day opens when Polymarket lists it.</div>
      ) : (
        <div className="grid">
          {live.map((q) => (
            <QuestionCard key={q.id} q={q} now={now} />
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <>
          <h2 className="section-title">Closed and settled</h2>
          <div className="grid">
            {rest.map((q) => (
              <QuestionCard key={q.id} q={q} now={now} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

/** New York | London, the current one marked. */
function CitySwitch({ current }: { current: City }) {
  return (
    <nav className="city-switch" aria-label="City">
      {CITIES.map((c) => (
        <a key={c.slug} href={`#/${c.slug}`} className={c.slug === current.slug ? "on" : undefined} aria-current={c.slug === current.slug ? "page" : undefined}>
          {c.name}
        </a>
      ))}
    </nav>
  );
}

/** A question as a card: the day, its status, then either the winner or the leading answer and the two after it. */
function QuestionCard({ q, now }: { q: Question; now: number }) {
  const meta = useTokenMeta(q.collateral);
  const phase = phaseOf(q, now);
  const { title, date, replay } = splitTitle(q.title);
  const ranked = q.prices
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (b.p > a.p ? 1 : b.p < a.p ? -1 : 0));
  const [lead, ...next] = ranked;
  const d = meta.data?.decimals ?? 6;

  return (
    <a className="card q-card" href={`#/q/${q.id}`}>
      <div className="q-card-top">
        <span className="q-date">{date ?? title}</span>
        {phase === "trading" ? (
          <span className="pill live">Closes in {timeLeft(q.closeTime - now)}</span>
        ) : phase === "resolved" ? (
          <span className="pill">Settled</span>
        ) : (
          <span className="pill warn">Awaiting result</span>
        )}
      </div>

      {phase === "resolved" && q.winner !== null ? (
        <div className="q-lead">
          <span className="q-lead-label">Winner</span>
          <span className="q-lead-answer">{q.answers[q.winner]}</span>
          <span className="muted small">Paid ${formatUnits((q.payouts[q.winner] ?? 0n) / 10n ** 12n, 6)} per token</span>
        </div>
      ) : (
        lead && (
          <>
            <div className="q-lead">
              <span className="q-lead-label">Most likely</span>
              <span className="q-lead-row">
                <span className="q-lead-answer">{q.answers[lead.i]}</span>
                <span className="q-lead-pct num">{formatPercent(lead.p, 0)}</span>
              </span>
            </div>
            <div className="stack" style={{ gap: 6 }}>
              {next.slice(0, 2).map(({ p, i }) => (
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
          </>
        )
      )}

      <div className="card-foot">
        <span className="muted">
          ${formatUnits(q.fund, d, 0)} fund · priced like ${formatUnits(q.virtualLiquidity, d, 0)}
        </span>
        {replay && <span className="pill">Replay</span>}
      </div>
    </a>
  );
}
