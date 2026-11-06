/** Sends transactions through the wallet and reports what happened, read from AIMM's events rather than the
 * transaction status, since a refused purchase still "succeeds" at the token. */
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useToast } from "../components/Toasts";
import { EXPLORER_URL } from "../config";
import type { Tx } from "../near/aimm";
import { aimmEvents, failureOf, hashOf, type AimmEvent } from "../near/outcome";
import { useWallet } from "../near/wallet";

export function useTransaction() {
  const wallet = useWallet();
  const toast = useToast();
  const client = useQueryClient();
  const [pending, setPending] = useState(false);

  const run = useCallback(
    /** `expect` is the AIMM event that means it worked; `done` is the toast text built from it. */
    async (txs: Tx[], expect: string | null, done: (ev: AimmEvent | undefined) => string): Promise<boolean> => {
      setPending(true);
      try {
        const outcomes = await wallet.send(txs);
        if (outcomes.length === 0) return false; // the wallet redirected; the result comes back in the URL
        const last = outcomes[outcomes.length - 1];
        const hash = hashOf(last);
        const href = hash ? `${EXPLORER_URL}/txns/${hash}` : undefined;
        const failure = outcomes.map(failureOf).find((f) => f !== null);
        const ev = expect ? aimmEvents(last).find((e) => e.event === expect) : undefined;
        if (failure || (expect && !ev)) {
          toast({ kind: "error", text: failure ?? "AIMM did not take the trade; your money came back.", href, linkText: "Details" });
          return false;
        }
        toast({ text: done(ev), href, linkText: "View transaction" });
        return true;
      } catch (e) {
        const text = e instanceof Error ? e.message : String(e);
        if (!/reject|cancel|closed/i.test(text)) toast({ kind: "error", text });
        return false;
      } finally {
        setPending(false);
        void client.invalidateQueries();
      }
    },
    [wallet, toast, client],
  );

  return { run, pending };
}
