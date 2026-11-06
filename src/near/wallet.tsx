/** The wallet: NEAR Wallet Selector, with Meteor and MetaMask (or any Ethereum wallet in the browser). Every transaction is signed in the wallet;
 * the app never holds a key. */
import type { WalletSelector } from "@near-wallet-selector/core";
import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Tx } from "./aimm";

interface WalletState {
  ready: boolean;
  accountId: string | null;
  signIn(): void;
  signOut(): Promise<void>;
  /** Signs and sends the transactions in order. Resolves with each outcome, or with [] when the wallet redirected away
   * (MyNearWallet) and the result will arrive in the URL on return. */
  send(txs: Tx[]): Promise<unknown[]>;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [selector, setSelector] = useState<WalletSelector | null>(null);
  const [modal, setModal] = useState<WalletSelectorModal | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};
    void import("./selector").then(async ({ createSelector }) => {
      const { selector: s, modal: m } = await createSelector();
      if (cancelled) return;
      setSelector(s);
      setModal(m);
      const sub = s.store.observable.subscribe((state) => setAccountId(state.accounts.find((a) => a.active)?.accountId ?? null));
      unsubscribe = () => sub.unsubscribe();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(() => modal?.show(), [modal]);

  const signOut = useCallback(async () => {
    if (!selector) return;
    const wallet = await selector.wallet();
    await wallet.signOut();
  }, [selector]);

  const send = useCallback(
    async (txs: Tx[]) => {
      if (!selector || !accountId) throw new Error("Connect a wallet first");
      const wallet = await selector.wallet();
      if (txs.length === 1) {
        const out = await wallet.signAndSendTransaction({ signerId: accountId, ...txs[0]! });
        return out ? [out] : [];
      }
      const out = await wallet.signAndSendTransactions({ transactions: txs.map((t) => ({ signerId: accountId, ...t })) });
      return out ?? [];
    },
    [selector, accountId],
  );

  const value = useMemo(() => ({ ready: selector !== null, accountId, signIn, signOut, send }), [selector, accountId, signIn, signOut, send]);
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const w = useContext(WalletContext);
  if (!w) throw new Error("useWallet outside WalletProvider");
  return w;
}
