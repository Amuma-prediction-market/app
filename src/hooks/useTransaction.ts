/** Sends transactions through the wallet and reports what happened, read from AIMM's events rather than the
 * transaction status, since a refused purchase still "succeeds" at the token. */
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useToast } from "../components/Toasts";
import { EXPLORER_URL } from "../config";
import { shortAccount } from "../lib/format";
import type { Tx } from "../near/aimm";
import { aimmEvents, failureOf, hashOf, signerOf, walletErrorText, type AimmEvent } from "../near/outcome";
import { useWallet } from "../near/wallet";

export function useTransaction() {
  const wallet = useWallet();
  const toast = useToast();
  const client = useQueryClient();
  const [pending, setPending] = useState(false);

  const run = useCallback(
    /** `expect` is the AIMM event that means it worked; `done` is the toast text built from it. */
    async (txs: Tx[], expect: string | null, done: (ev: AimmEvent | undefined) => string): Promise<boolean> => {
      const from = wallet.accountId;
      setPending(true);
      try {
        const outcomes = await wallet.send(txs);
        if (outcomes.length === 0) return false; // the wallet redirected; the result comes back in the URL
        const last = outcomes[outcomes.length - 1];
        const hash = hashOf(last);
        const href = hash ? `${EXPLORER_URL}/txns/${hash}` : undefined;
        const failure = outcomes.map(failureOf).find((f) => f !== null);
        const events = aimmEvents(last);
        const ev = expect ? events.find((e) => e.event === expect) : undefined;
        // The expected event means AIMM did it. A sale or redemption pays out in a transfer of its own afterwards; if
        // the token refuses that (say the holder is not registered with it), AIMM keeps the money as pending, so the
        // trade still counts as done and only a failure without the event is reported as one.
        if (expect ? !ev : failure) {
          toast({ kind: "error", text: failure ?? "Amuma did not take the trade; your money came back.", href, linkText: "Details" });
          return false;
        }
        let text = done(ev);
        if (expect && events.some((e) => e.event === "payment_failed")) text += " The payout is kept for you; withdraw it from your position.";
        // a wallet may sign from whichever account it has selected when you confirm, not the one the trade was set up for
        const signer = signerOf(last);
        if (signer && from && signer !== from) text += ` Sent from ${shortAccount(signer)}, the account now selected in your wallet.`;
        toast({ text, href, linkText: "View transaction" });
        return true;
      } catch (e) {
        const text = walletErrorText(e);
        if (text) toast({ kind: "error", text });
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
