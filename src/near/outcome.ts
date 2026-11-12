/** Reads what a transaction did. On NEAR a call to the collateral's ft_transfer_call succeeds even when AIMM refuses the
 * trade (the money comes back), so success is read from AIMM's own event, not from the transaction's status. */

export interface AimmEvent {
  event: string;
  data: Record<string, unknown>;
}

interface Outcome {
  transaction?: { hash?: string; signer_id?: string };
  transaction_outcome?: { id?: string };
  receipts_outcome?: { outcome: { logs: string[]; status: unknown } }[];
}

export function aimmEvents(outcome: unknown): AimmEvent[] {
  const o = outcome as Outcome;
  const out: AimmEvent[] = [];
  for (const r of o.receipts_outcome ?? []) {
    // a receipt that failed was rolled back, so an event it logged before failing did not happen
    if (isFailure(r.outcome.status)) continue;
    for (const log of r.outcome.logs) {
      if (!log.startsWith("EVENT_JSON:")) continue;
      try {
        const body = JSON.parse(log.slice("EVENT_JSON:".length)) as { standard?: string; event: string; data: Record<string, unknown>[] };
        if (body.standard === "aimm") for (const d of body.data) out.push({ event: body.event, data: d });
      } catch {
        // a log that only looks like an event is not one
      }
    }
  }
  return out;
}

function isFailure(status: unknown): status is { Failure: unknown } {
  return !!status && typeof status === "object" && "Failure" in status;
}

/** The readable reason inside a failure, or null if there is none. The contract says "AIMM: ..."; people see the site's
 * name, "Amuma: ...". */
function reasonIn(text: string): string | null {
  const m = text.match(/AIMM: [^"\\]+/) ?? text.match(/"ExecutionError":"([^"]+)"/) ?? text.match(/Smart contract panicked: ([^"\\]+)/);
  return m ? (m[1] ?? m[0]).replace(/AIMM: /g, "Amuma: ") : null;
}

/** The first failure message in the transaction's receipts, as reasonIn gives it. */
export function failureOf(outcome: unknown): string | null {
  const o = outcome as Outcome;
  for (const r of o.receipts_outcome ?? []) {
    if (isFailure(r.outcome.status)) return reasonIn(JSON.stringify(r.outcome.status.Failure)) ?? "The transaction failed";
  }
  return null;
}

/** What a wallet threw, as text for a person, or null when the person cancelled it themselves. Only real cancels count:
 * a broad match on "closed" would also hide AIMM's own "TradingClosed". MetaMask's library throws a contract failure as
 * nested JSON, so the reason is read out of it the same way as from a receipt. */
export function walletErrorText(e: unknown): string | null {
  const err = e as { message?: unknown; code?: unknown; cause?: { code?: unknown } } | null;
  const text = typeof e === "string" ? e : typeof err?.message === "string" ? err.message : String(e);
  // EIP-1193's "user rejected" code, then the cancel texts of the MetaMask library, viem and Meteor
  if (err?.code === 4001 || err?.cause?.code === 4001) return null;
  if (/^User (canceled Ethereum wallet transaction|rejected|closed the window|cancelled the action|didn't complete the action)/.test(text)) return null;
  return reasonIn(text) ?? (text || "The wallet did not send the transaction");
}

export function hashOf(outcome: unknown): string | null {
  const o = outcome as Outcome;
  return o.transaction?.hash ?? o.transaction_outcome?.id ?? null;
}

/** The account that signed the transaction, when the wallet's result says. */
export function signerOf(outcome: unknown): string | null {
  return (outcome as Outcome).transaction?.signer_id ?? null;
}
