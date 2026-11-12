/** The wallet: NEAR Wallet Selector, with Meteor. Every transaction is signed in the wallet;
 * the app never holds a key. */
import type { WalletSelector } from "@near-wallet-selector/core";
import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Tx } from "./aimm";

interface WalletState {
  ready: boolean;
  /** The wallet code could not load (a dropped download, or browser storage turned off); a reload tries again. */
  failed: boolean;
  /** A request sent through `send` is still open in the wallet. */
  busy: boolean;
  accountId: string | null;
  signIn(): void;
  signOut(): Promise<void>;
  /** Signs and sends the transactions in order. Resolves with each outcome, or with [] when the wallet redirected away
   * (MyNearWallet) and the result will arrive in the URL on return. Refuses while another request is open. */
  send(txs: Tx[]): Promise<unknown[]>;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [selector, setSelector] = useState<WalletSelector | null>(null);
  const [modal, setModal] = useState<WalletSelectorModal | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  // refs, not state: `send` must see a second click and an account switch at once, not after the next render
  const busyRef = useRef(false);
  const accountRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};
    import("./selector")
      .then(async ({ createSelector }) => {
        const { selector: s, modal: m } = await createSelector();
        if (cancelled) return;
        setSelector(s);
        setModal(m);
        const sub = s.store.observable.subscribe((state) => {
          const id = state.accounts.find((a) => a.active)?.accountId ?? null;
          accountRef.current = id;
          setAccountId(id);
        });
        unsubscribe = () => sub.unsubscribe();
      })
      .catch((e: unknown) => {
        // without this the Connect button would stay greyed out with no reason given
        console.error("The wallet could not load", e);
        if (!cancelled) setFailed(true);
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
      // One request at a time. MetaMask's confirm window is an overlay that its library finds by class name, so a second
      // one opened before the first closes binds to the first and is left blank, with a Cancel that does nothing.
      if (busyRef.current) throw new Error("Another wallet request is still open");
      busyRef.current = true;
      setBusy(true);
      try {
        const wallet = await selector.wallet();
        if (txs.length === 1) {
          const out = await wallet.signAndSendTransaction({ signerId: accountId, ...txs[0]! });
          return out ? [out] : [];
        }
        const out = await wallet.signAndSendTransactions({ transactions: txs.map((t) => ({ signerId: accountId, ...t })) });
        return out ?? [];
      } catch (e) {
        // MetaMask signs from the account selected when you confirm, not the one the request was made for, so a switch
        // halfway through fails (or is cancelled) on the new account; say that rather than show its bare error
        if (accountRef.current !== null && accountRef.current !== accountId)
          throw new Error("Your wallet switched accounts during this request. Please try again from the new account.", { cause: e });
        throw e;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [selector, accountId],
  );

  const value = useMemo(
    () => ({ ready: selector !== null, failed, busy, accountId, signIn, signOut, send }),
    [selector, failed, busy, accountId, signIn, signOut, send],
  );
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const w = useContext(WalletContext);
  if (!w) throw new Error("useWallet outside WalletProvider");
  return w;
}

/** A phone or tablet. iPadOS Safari reports itself as a Mac, so a Mac with a touch screen counts too. */
export function isPhone(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

/** True when the browser has an Ethereum wallet in it (MetaMask's own browser, or a desktop extension). */
export function hasInjectedWallet(): boolean {
  return typeof (window as { ethereum?: unknown }).ethereum !== "undefined";
}

/** A link that opens the page the user is on now inside the MetaMask app's browser, where MetaMask can sign. Built when
 * it is followed, since the site's routes live in the hash and change without a reload. */
export function metaMaskAppLink(): string {
  const { host, pathname, search, hash } = window.location;
  return `https://metamask.app.link/dapp/${host}${pathname}${search}${hash}`;
}
