import { useNow, useQuestions } from "../hooks/data";
import { CITIES, cityOfTitle, splitTitle, timeLeft, type City } from "../lib/format";
import { formatPercent } from "../lib/units";
import { phaseOf, type Question } from "../near/aimm";

/** The front page: two choices, New York and London. Each city's questions are on its own page (CityPage). */
export function Home() {
  const questions = useQuestions();
  const now = useNow(30_000);
  const all = (questions.data ?? []).filter((q) => q.opened);

  return (
    <>
      <section className="hero">
        <div className="eyebrow">Daily high</div>
        <h1>Trade tomorrow's high temperature</h1>
        <p>
          The operator backs each question with a small fund, yet Amuma prices it as deep as a market many times larger. Next
          to every price, Amuma publishes its prediction range: how far that price can be trusted, given what the pot
          can pay.
        </p>
      </section>

      <h2 className="section-title">Choose a city</h2>
      <div className="city-grid">
        {CITIES.map((c) => (
          <CityChoice
            key={c.slug}
            city={c}
            questions={all.filter((q) => cityOfTitle(q.title)?.slug === c.slug)}
            loading={questions.isPending}
            now={now}
          />
        ))}
      </div>
    </>
  );
}

/** A city as one big choice: its name, and what is trading there now (the question closing soonest). */
function CityChoice({ city, questions, loading, now }: { city: City; questions: Question[]; loading: boolean; now: number }) {
  const live = questions.filter((q) => phaseOf(q, now) === "trading");
  const next = live.reduce<Question | null>((a, q) => (!a || q.closeTime < a.closeTime ? q : a), null);
  const lead = next ? next.prices.reduce((best, p, i) => (p > (next.prices[best] ?? 0n) ? i : best), 0) : null;
  return (
    <a className="card city-card" href={`#/${city.slug}`}>
      <span className="city-name">{city.name}</span>
      {loading ? (
        <span className="muted small">Reading testnet…</span>
      ) : next && lead !== null ? (
        <span className="city-now">
          <span className="pill live">Closes in {timeLeft(next.closeTime - now)}</span>
          <span className="small">
            {splitTitle(next.title).date}: <strong>{next.answers[lead]}</strong> leads at <strong className="num">{formatPercent(next.prices[lead] ?? 0n, 0)}</strong>
          </span>
        </span>
      ) : (
        <span className="muted small">Nothing trading right now · past questions inside</span>
      )}
      <span className="city-go">Open {city.name} →</span>
    </a>
  );
}
