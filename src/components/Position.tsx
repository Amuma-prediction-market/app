import { useHoldings } from "../hooks/data";
import { useTransaction } from "../hooks/useTransaction";
import { formatUnits, WAD } from "../lib/units";
import { redeemTx, settlementValue, withdrawPendingTx, type Phase, type Question } from "../near/aimm";
import { useWallet } from "../near/wallet";
import type { Selection } from "./Ladder";

/** What the signed-in account holds in this question, what it is worth, and redeem once the result is in. */
export function Position({
  q,
  phase,
  decimals,
  symbol,
  onSell,
}: {
  q: Question;
  phase: Phase;
  decimals: number;
  symbol: string;
  onSell: (s: Selection) => void;
}) {
  const wallet = useWallet();
  const held = useHoldings(q.id, wallet.accountId);
  const tx = useTransaction();
  if (!wallet.accountId || !held.data) return null;
  const h = held.data;

  const lines = q.answers.flatMap((answer, i) =>
    ([true, false] as const)
      .map((yes) => ({ answer, i, yes, tokens: (yes ? h.yes[i] : h.no[i]) ?? 0n }))
      .filter((l) => l.tokens > 0n),
  );
  const owed = settlementValue(q, h);
  if (lines.length === 0 && h.pending === 0n) return null;

  return (
    <div className="card card-pad stack">
      <div style={{ fontWeight: 700 }}>Your position</div>
      {lines.map((l) => {
        const p = q.prices[l.i];
        const value = p === undefined ? null : (l.tokens * (l.yes ? p : WAD - p)) / WAD;
        return (
          <div key={`${l.i}${l.yes}`} className="rows num" style={{ gap: 2 }}>
            <div>
              <span>
                <strong style={{ color: l.yes ? "var(--yes)" : "var(--no)" }}>{l.yes ? "Yes" : "No"}</strong> {l.answer}
              </span>
              <span className="strong">{formatUnits(l.tokens, decimals)}</span>
            </div>
            <div className="small">
              <span className="faint">{value !== null ? `Worth ${formatUnits(value, decimals)} ${symbol} at the price` : ""}</span>
              {phase === "trading" && (
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onSell({ range: l.i, yes: l.yes });
                  }}
                >
                  Sell
                </a>
              )}
            </div>
          </div>
        );
      })}
      {phase === "resolved" && lines.length > 0 && (
        <button
          className="btn primary block"
          disabled={tx.pending}
          onClick={() => void tx.run([redeemTx(q)], "redeem", (ev) => `Redeemed ${formatUnits(BigInt(String(ev?.data.amount ?? owed)), decimals)} ${symbol}.`)}
        >
          {owed > 0n ? `Redeem ${formatUnits(owed, decimals)} ${symbol}` : "Clear losing tokens"}
        </button>
      )}
      {h.pending > 0n && (
        <>
          <div className="notice warn">
            {formatUnits(h.pending, decimals)} {symbol} could not be delivered to your account and is kept for you.
          </div>
          <button className="btn block" disabled={tx.pending} onClick={() => void tx.run([withdrawPendingTx(q)], null, () => "Sent to your account.")}>
            Withdraw {formatUnits(h.pending, decimals)} {symbol}
          </button>
        </>
      )}
    </div>
  );
}
