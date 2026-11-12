import { formatPayout, formatUnits, WAD } from "../lib/units";
import type { Question } from "../near/aimm";

/** What backs the question: the operator's fund, the depth it prices at, the pot, and what a winner is paid. */
export function Stats({ q, decimals, symbol }: { q: Question; decimals: number; symbol: string }) {
  // once settled, the losing answers pay 0 and only the winner's payout means anything
  const short = q.resolved ? [] : q.payouts.map((p, i) => ({ p, i })).filter(({ p }) => p < WAD);
  const worst = short.reduce<{ p: bigint; i: number } | null>((a, b) => (a === null || b.p < a.p ? b : a), null);
  const ratio = q.fund > 0n ? Number((q.virtualLiquidity * 100n) / q.fund) / 100 : 0;
  const payoutNote = q.resolved
    ? `Each winning token is paid ${formatPayout(q.payouts[q.winner ?? 0] ?? 0n)}`
    : worst
      ? `The pot is short of ${q.answers[worst.i]}'s winners: each would be paid ${formatPayout(worst.p)} if it won now`
      : "The pot can pay every winner in full, whichever answer wins";
  return (
    <div className="stats">
      <div className="stat" title="The money the operator actually put up">
        <div className="label">Operator's fund ℓ</div>
        <div className="value num">
          {formatUnits(q.fund, decimals, 0)} <span className="small faint">{symbol}</span>
        </div>
      </div>
      <div className="stat" title="The money an ordinary market maker would need to price this deep">
        <div className="label">Priced as deep as L</div>
        <div className="value num">
          {formatUnits(q.virtualLiquidity, decimals, 0)} <span className="small faint">{ratio.toFixed(1)}× the fund</span>
        </div>
      </div>
      <div className="stat" title="The fund plus what buyers paid, less what sellers and winners took">
        <div className="label">Pot</div>
        <div className="value num">{formatUnits(q.pot, decimals, 0)}</div>
      </div>
      <div className="stat" title={payoutNote}>
        <div className="label">A winning token pays</div>
        <div className="value num">
          {q.resolved ? formatPayout(q.payouts[q.winner ?? 0] ?? 0n) : worst ? `≥ ${formatPayout(worst.p)}` : "$1.00"}
        </div>
        {/* a touch screen shows no title, so it names the answer here */}
        {worst && <div className="tiny faint touch-only">if {q.answers[worst.i]} wins</div>}
      </div>
    </div>
  );
}
