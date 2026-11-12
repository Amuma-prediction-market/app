import { useState } from "react";
import { useAccount, useHoldings } from "../hooks/data";
import { useFaucet } from "../hooks/useFaucet";
import { useTransaction } from "../hooks/useTransaction";
import { formatUnits, WAD } from "../lib/units";
import { noPayout, redeemTx, settlementValue, withdrawPendingTx, type Phase, type Question } from "../near/aimm";
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
  const account = useAccount(q.collateral, wallet.accountId);
  const faucet = useFaucet(q.collateral);
  const tx = useTransaction();
  // the look before a redeem takes a moment, and a second click meanwhile must not send a second redeem
  const [checking, setChecking] = useState(false);
  if (!wallet.accountId || !held.data) return null;
  const h = held.data;

  const lines = q.answers.flatMap((answer, i) =>
    ([true, false] as const)
      .map((yes) => ({ answer, i, yes, tokens: (yes ? h.yes[i] : h.no[i]) ?? 0n }))
      .filter((l) => l.tokens > 0n),
  );
  const owed = settlementValue(q, h);
  if (lines.length === 0 && h.pending === 0n) return null;
  // a payout goes to the account's token balance, so an account the token does not know cannot take it yet
  const unregistered = h.pending > 0n && account.data?.registered === false;

  // another tab, or a read from before an earlier redeem, can still show tokens already redeemed: look again first,
  // and send nothing when they are gone (the position then leaves the page)
  const redeem = async () => {
    setChecking(true);
    const now = await held.refetch().then((r) => r.data ?? h, () => h);
    setChecking(false);
    if (![...now.yes, ...now.no].some((x) => x > 0n)) return;
    await tx.run([redeemTx(q)], "redeem", (ev) => {
      const paid = BigInt(String(ev?.data.amount ?? owed));
      return paid > 0n ? `Redeemed ${formatUnits(paid, decimals)} ${symbol}.` : "Your losing tokens are cleared.";
    });
  };

  return (
    <div className="card card-pad stack">
      <div style={{ fontWeight: 700 }}>Your position</div>
      {lines.map((l) => {
        const p = q.prices[l.i];
        // a token returns no more than its payout, by sale or by win, so the price counts only up to that
        const payout = l.yes ? (q.payouts[l.i] ?? WAD) : noPayout(q, l.i);
        const at = p === undefined ? null : l.yes ? p : WAD - p;
        const capped = at !== null && payout < at;
        const value = at === null ? null : (l.tokens * (capped ? payout : at)) / WAD;
        return (
          <div key={`${l.i}${l.yes}`} className="rows num" style={{ gap: 2 }}>
            <div>
              <span>
                <strong style={{ color: l.yes ? "var(--yes)" : "var(--no)" }}>{l.yes ? "Yes" : "No"}</strong> {l.answer}
              </span>
              <span className="strong">{formatUnits(l.tokens, decimals)}</span>
            </div>
            <div className="small">
              <span className="faint">{value !== null ? `Worth ${formatUnits(value, decimals)} ${symbol} at the ${capped ? "payout" : "price"}` : ""}</span>
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
        <button className="btn primary block" disabled={tx.pending || checking || wallet.busy} onClick={() => void redeem()}>
          {owed > 0n ? `Redeem ${formatUnits(owed, decimals)} ${symbol}` : "Clear losing tokens"}
        </button>
      )}
      {h.pending > 0n && (
        <>
          <div className="notice warn">
            {formatUnits(h.pending, decimals)} {symbol} could not be delivered to your account and is kept for you.
            {unregistered && ` It is sent to your ${symbol} account, which the faucet below sets up; then withdraw it.`}
          </div>
          {unregistered && (
            <button className="btn block" disabled={!faucet.ready || wallet.busy} onClick={faucet.run}>
              Get 1,000 test {symbol}
            </button>
          )}
          <button
            className="btn block"
            disabled={tx.pending || wallet.busy || unregistered}
            onClick={() => void tx.run([withdrawPendingTx(q)], null, () => "Sent to your account.")}
          >
            Withdraw {formatUnits(h.pending, decimals)} {symbol}
          </button>
        </>
      )}
    </div>
  );
}
