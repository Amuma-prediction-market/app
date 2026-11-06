import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { REFRESH_MS } from "../config";
import { useAccount, useHoldings } from "../hooks/data";
import { useFaucet } from "../hooks/useFaucet";
import { GAS_NEEDED, isEthAccount, useGasFaucet } from "../hooks/useGasFaucet";
import { useTransaction } from "../hooks/useTransaction";
import { tokensFor } from "../lib/curve";
import { payoutAfterBuy } from "../lib/payout";
import { formatCents, formatPayout, formatUnits, parseUnits, WAD, wadToNumber } from "../lib/units";
import { buyTx, noPayout, quoteBuy, quoteSell, sellTx, type Phase, type Question } from "../near/aimm";
import { useWallet } from "../near/wallet";
import type { Selection } from "./Ladder";

/** How far the price may move between the quote and the trade before the contract refuses it. */
const SLIPPAGE_BPS = 100n;

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export type Side = "buy" | "sell";

export function TradePanel({
  q,
  phase,
  selection,
  onSelection,
  side,
  onSide,
  decimals,
  symbol,
}: {
  q: Question;
  phase: Phase;
  selection: Selection;
  onSelection: (s: Selection) => void;
  side: Side;
  onSide: (s: Side) => void;
  decimals: number;
  symbol: string;
}) {
  const wallet = useWallet();
  const account = useAccount(q.collateral, wallet.accountId);
  const held = useHoldings(q.id, wallet.accountId);
  const faucet = useFaucet(q.collateral);
  const gas = useGasFaucet(wallet.accountId);
  const tx = useTransaction();
  // one amount per tab: dollars to spend carry over between answers, tokens to sell are their own
  const [texts, setTexts] = useState<Record<Side, string>>({ buy: "", sell: "" });
  const text = texts[side];
  const setText = (t: string) => setTexts((all) => ({ ...all, [side]: t }));
  const { range, yes } = selection;
  const answer = q.answers[range] ?? "";
  const price = q.prices[range] ?? 0n;
  const sidePrice = yes ? price : WAD - price;
  const unit = 10n ** BigInt(decimals);

  const owned = held.data ? (yes ? held.data.yes[range] : held.data.no[range]) ?? 0n : 0n;
  const amount = parseUnits(text, decimals);
  const debounced = useDebounced(amount);

  // buy: money in, tokens out. The contract quotes by tokens, so estimate the tokens with the curve, then let the
  // contract price them, and trim until the total fits the money
  const buyQuote = useQuery({
    queryKey: ["quoteBuy", q.id, range, yes, debounced?.toString()],
    enabled: side === "buy" && phase === "trading" && !!debounced && debounced > 0n,
    refetchInterval: REFRESH_MS,
    queryFn: async () => {
      const spend = debounced!;
      const feeShare = 1 + wadToNumber(q.feeRate);
      let tokens = BigInt(Math.floor(tokensFor(Number(spend) / feeShare, wadToNumber(price), Number(q.depth), yes)));
      for (let k = 0; k < 4 && tokens > 0n; k++) {
        const quote = await quoteBuy(q.id, range, yes, tokens);
        if (quote.total <= spend) return { tokens, quote };
        tokens = (tokens * spend * 9_995n) / (quote.total * 10_000n);
      }
      return null;
    },
  });

  const sellQuote = useQuery({
    queryKey: ["quoteSell", q.id, range, yes, debounced?.toString()],
    enabled: side === "sell" && phase === "trading" && !!debounced && debounced > 0n && debounced <= owned,
    refetchInterval: REFRESH_MS,
    queryFn: () => quoteSell(q.id, range, yes, debounced!),
  });

  const fresh = amount === debounced;
  const buy = side === "buy" && fresh ? buyQuote.data : undefined;
  const sell = side === "sell" && fresh ? sellQuote.data : undefined;
  const balance = account.data?.balance ?? 0n;
  // the margin above the quote, but never more than the account holds: a quote it can pay is always sendable
  const margin = buy ? buy.quote.total + (buy.quote.total * SLIPPAGE_BPS) / 10_000n : 0n;
  const maxCost = buy ? (margin > balance && balance >= buy.quote.total ? balance : margin) : 0n;
  const payoutNow = yes ? (q.payouts[range] ?? WAD) : noPayout(q, range);
  const payoutAfter = buy ? payoutAfterBuy(q, range, yes, buy.tokens, buy.quote.amount) : payoutNow;
  const priceAfter = buy ? (yes ? buy.quote.pricesAfter[range]! : WAD - buy.quote.pricesAfter[range]!) : sell ? (yes ? sell.pricesAfter[range]! : WAD - sell.pricesAfter[range]!) : null;

  const submit = async () => {
    if (side === "buy" && buy) {
      const ok = await tx.run([buyTx(q, range, yes, buy.tokens, maxCost)], "buy", (ev) =>
        ev ? `Bought ${formatUnits(BigInt(String(ev.data.tickets)), decimals)} ${yes ? "Yes" : "No"} on ${answer} for ${formatUnits(BigInt(String(ev.data.cost)) + BigInt(String(ev.data.fee)), decimals)} ${symbol}.` : "Bought.",
      );
      if (ok) setText("");
    } else if (side === "sell" && sell && debounced) {
      const min = sell.total - (sell.total * SLIPPAGE_BPS) / 10_000n;
      const ok = await tx.run([sellTx(q, range, yes, debounced, min)], "sell", (ev) =>
        ev ? `Sold for ${formatUnits(BigInt(String(ev.data.refund)) - BigInt(String(ev.data.fee)), decimals)} ${symbol}.` : "Sold.",
      );
      if (ok) setText("");
    }
  };

  let action: { label: string; onClick?: () => void; disabled?: boolean; note?: string; tone?: "warn" | "error" };
  if (phase !== "trading") action = { label: phase === "resolved" ? "Settled" : "Trading has closed", disabled: true };
  else if (!wallet.accountId) action = { label: "Connect wallet to trade", onClick: wallet.signIn };
  else if (!account.data) action = { label: "Loading your account…", disabled: true };
  else if (account.data.near < GAS_NEEDED && isEthAccount(wallet.accountId))
    action = {
      label: gas.pending ? "Sending testnet NEAR…" : "Get testnet NEAR for gas",
      onClick: () => void gas.run(),
      disabled: gas.pending,
      note: "Your MetaMask address is your NEAR account. It starts with no NEAR, and every trade needs a little for gas; this sends 0.25 testnet NEAR, free.",
    };
  else if (account.data.near < GAS_NEEDED)
    action = { label: "Your account needs testnet NEAR", disabled: true, tone: "warn", note: "Every trade pays a little NEAR for gas. Your wallet's testnet faucet can send some." };
  else if (side === "buy" && (!account.data.registered || balance === 0n))
    action = { label: `Get 1,000 test ${symbol}`, onClick: faucet.run, disabled: !faucet.ready, note: `${symbol} is a test dollar with a free faucet. One approval registers your account with it and mints 1,000.` };
  else if (!amount || amount === 0n) action = { label: side === "buy" ? "Enter an amount" : "Enter how many to sell", disabled: true };
  else if (side === "sell" && amount > owned) action = { label: "More than you hold", disabled: true, tone: "error" };
  else if (side === "buy" && amount > balance) action = { label: `Not enough ${symbol}`, disabled: true, tone: "error", note: `You have ${formatUnits(balance, decimals)}. The faucet in your account menu gives 1,000 more.` };
  else if ((side === "buy" && !buy) || (side === "sell" && !sell)) {
    const err = side === "buy" ? buyQuote.error : sellQuote.error;
    action = err ? { label: "Can't quote this trade", disabled: true, tone: "error", note: String(err instanceof Error ? err.message.replace(/^.*AIMM: /, "") : err) } : { label: "Getting a quote…", disabled: true };
  } else action = { label: `${side === "buy" ? "Buy" : "Sell"} ${yes ? "Yes" : "No"} · ${answer}`, onClick: () => void submit(), disabled: tx.pending };

  if (phase !== "trading") {
    return (
      <div className="card card-pad stack">
        <div style={{ fontWeight: 700 }}>{phase === "resolved" ? "This question is settled" : "Trading has closed"}</div>
        <div className="small muted">
          {phase === "resolved"
            ? `${q.winner !== null ? q.answers[q.winner] : "The result"} won. Holders of winning tokens redeem them below; a redemption pays only the holder, so anyone may trigger it.`
            : phase === "closed"
              ? `${q.resolver} reports the result after the close; then winning tokens can be redeemed.`
              : "This question is not open for trading."}
        </div>
      </div>
    );
  }

  const chips = side === "buy" ? [10n, 50n, 100n, 500n].map((d) => d * unit) : owned > 0n ? [owned / 4n, owned / 2n, owned] : [];

  return (
    <div className="card">
      <div className="tabs" role="tablist">
        {(["buy", "sell"] as const).map((s) => (
          <button key={s} role="tab" aria-selected={side === s} className={side === s ? "on" : ""} onClick={() => onSide(s)}>
            {s === "buy" ? "Buy" : "Sell"}
          </button>
        ))}
      </div>
      <div className="card-pad stack">
        <div>
          <div className="small faint">Answer</div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{answer}</div>
        </div>
        <div className="seg">
          {[true, false].map((y) => (
            <button key={String(y)} className={`${y ? "yes" : "no"} ${yes === y ? "on" : ""}`} onClick={() => onSelection({ range, yes: y })}>
              {y ? "Yes" : "No"} {formatCents(y ? price : WAD - price)}
            </button>
          ))}
        </div>

        <div className="stack" style={{ gap: 8 }}>
          <label className="small muted" htmlFor="amount">
            {side === "buy" ? `Amount to spend (${symbol})` : `Tokens to sell (you hold ${formatUnits(owned, decimals)})`}
          </label>
          <div className="field">
            {side === "buy" && <span className="faint" style={{ fontSize: 22 }}>$</span>}
            <input
              id="amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={text}
              onChange={(e) => setText(e.target.value.replace(",", "."))}
              disabled={phase !== "trading"}
            />
          </div>
          {chips.length > 0 && phase === "trading" && (
            <div className="chips">
              {chips.map((c, k) => (
                <button key={k} onClick={() => setText(formatUnits(c, decimals, decimals).replace(/,/g, "").replace(/\.?0+$/, ""))}>
                  {side === "buy" ? `$${formatUnits(c, decimals, 0)}` : ["¼", "½", "Max"][k]}
                </button>
              ))}
            </div>
          )}
        </div>

        {(buy || sell) && (
          <div className="rows num">
            {buy && (
              <>
                <div>
                  <span className="muted">Tokens you get</span>
                  <span className="strong">{formatUnits(buy.tokens, decimals)}</span>
                </div>
                <div>
                  <span className="muted">Average price</span>
                  <span>{formatCents((buy.quote.total * WAD) / buy.tokens)}</span>
                </div>
              </>
            )}
            {sell && (
              <div>
                <span className="muted">You receive</span>
                <span className="strong">
                  {formatUnits(sell.total, decimals)} {symbol}
                </span>
              </div>
            )}
            {priceAfter !== null && (
              <div>
                <span className="muted">Price after</span>
                <span>
                  {formatCents(sidePrice)} → {formatCents(priceAfter)}
                </span>
              </div>
            )}
            {(buy?.quote.fee ?? sell?.fee ?? 0n) > 0n && (
              <div>
                <span className="muted">Fee</span>
                <span>{formatUnits(buy?.quote.fee ?? sell?.fee ?? 0n, decimals)}</span>
              </div>
            )}
            {buy && (
              <>
                <div title="Every winning token is paid min(1, pot ÷ winning tokens), the same whenever it was bought">
                  <span className="muted">Each pays if {yes ? "it wins" : `${answer} loses`}</span>
                  <span>
                    {formatPayout(payoutAfter)}
                    {payoutAfter < payoutNow && <span className="faint"> (now {formatPayout(payoutNow)})</span>}
                  </span>
                </div>
                <div>
                  <span className="muted">You'd be paid</span>
                  <span className="strong" style={{ color: "var(--yes)" }}>
                    {formatUnits((buy.tokens * payoutAfter) / WAD, decimals)} {symbol}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {buy && payoutAfter + WAD / 100n < payoutNow && (
          <div className="notice warn">
            This buy would leave the pot short of {yes ? answer : "these answers"}'s winners: each winning token would be paid{" "}
            {formatPayout(payoutAfter)}, not {formatPayout(payoutNow)}, until more money comes in. That is how AIMM backs a deep market with a small fund,
            and why the information interval widens.
          </div>
        )}
        <button className="btn primary block" onClick={action.onClick} disabled={action.disabled}>
          {tx.pending ? "Confirm in your wallet…" : action.label}
        </button>
        {action.note && <div className={`notice ${action.tone ?? ""}`}>{action.note}</div>}
        {side === "buy" && buy && (
          <div className="tiny faint">
            Sends at most {formatUnits(maxCost, decimals)} {symbol}, up to 1% above the quote, in case the price moves first. What the trade does not use comes back in the same transaction.
          </div>
        )}
      </div>
    </div>
  );
}
