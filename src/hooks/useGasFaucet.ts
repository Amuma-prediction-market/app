import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "../components/Toasts";
import { EXPLORER_URL, GAS_FAUCET_URL } from "../config";

/** A new testnet account may hold no NEAR, so the gas faucet sends it a little. */
export const GAS_NEEDED = 5n * 10n ** 22n; // 0.05 NEAR, the faucet's own threshold

export const isEthAccount = (id: string | null) => !!id && /^0x[0-9a-f]{40}$/.test(id);

export function useGasFaucet(accountId: string | null) {
  const toast = useToast();
  const client = useQueryClient();
  const [pending, setPending] = useState(false);
  const run = async () => {
    if (!accountId) return;
    setPending(true);
    try {
      const res = await fetch(GAS_FAUCET_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ account: accountId }) });
      const body = (await res.json()) as { tx?: string; error?: string };
      if (!res.ok || !body.tx) toast({ kind: "error", text: body.error ?? "The gas faucet did not answer" });
      else toast({ text: "0.25 testnet NEAR is on its way for gas.", href: `${EXPLORER_URL}/txns/${body.tx}`, linkText: "View transaction" });
    } catch {
      toast({ kind: "error", text: "The gas faucet could not be reached" });
    } finally {
      setPending(false);
      void client.invalidateQueries();
    }
  };
  return { run, pending };
}
