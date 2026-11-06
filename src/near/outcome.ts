/** Reads what a transaction did. On NEAR a call to the collateral's ft_transfer_call succeeds even when AIMM refuses the
 * trade (the money comes back), so success is read from AIMM's own event, not from the transaction's status. */

export interface AimmEvent {
  event: string;
  data: Record<string, unknown>;
}

interface Outcome {
  transaction?: { hash?: string };
  transaction_outcome?: { id?: string };
  receipts_outcome?: { outcome: { logs: string[]; status: unknown } }[];
}

export function aimmEvents(outcome: unknown): AimmEvent[] {
  const o = outcome as Outcome;
  const out: AimmEvent[] = [];
  for (const r of o.receipts_outcome ?? []) {
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

/** The first failure message in the transaction's receipts, with the contract's "AIMM: " prefix kept. */
export function failureOf(outcome: unknown): string | null {
  const o = outcome as Outcome;
  for (const r of o.receipts_outcome ?? []) {
    const status = r.outcome.status as { Failure?: unknown } | undefined;
    if (status && typeof status === "object" && "Failure" in status) {
      const text = JSON.stringify(status.Failure);
      const m = text.match(/AIMM: [^"\\]+/) ?? text.match(/"ExecutionError":"([^"]+)"/) ?? text.match(/Smart contract panicked: ([^"\\]+)/);
      return m ? (m[1] ?? m[0]) : "The transaction failed";
    }
  }
  return null;
}

export function hashOf(outcome: unknown): string | null {
  const o = outcome as Outcome;
  return o.transaction?.hash ?? o.transaction_outcome?.id ?? null;
}
