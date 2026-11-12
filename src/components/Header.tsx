import { useEffect, useRef, useState } from "react";
import { EXPLORER_URL } from "../config";
import { useAccount, useTokenMeta } from "../hooks/data";
import { useFaucet } from "../hooks/useFaucet";
import { GAS_NEEDED, useGasFaucet } from "../hooks/useGasFaucet";
import { formatUnits } from "../lib/units";
import { shortAccount } from "../lib/format";
import { useWallet } from "../near/wallet";

export function Header({ collateral }: { collateral: string | undefined }) {
  const wallet = useWallet();
  const meta = useTokenMeta(collateral);
  const account = useAccount(collateral, wallet.accountId);
  const faucet = useFaucet(collateral);
  const gas = useGasFaucet(wallet.accountId);
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="brand" href="#/">
          <span className="brand-mark" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 32 32">
              <path d="M5 25h22M9.5 19l6.5-11 6.5 11" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          Amuma <span className="faint brand-sub" style={{ fontWeight: 500 }}>Weather</span>
        </a>
        <span className="pill net-pill">NEAR testnet</span>
        <span className="spacer" />
        {wallet.accountId ? (
          <>
            {account.data && meta.data && (
              <span className="small num muted brand-sub" title="Your test dollars">
                {formatUnits(account.data.balance, meta.data.decimals)} {meta.data.symbol}
              </span>
            )}
            <div className="menu" ref={menu}>
              <button className="btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
                {shortAccount(wallet.accountId)}
              </button>
              {open && (
                <div className="menu-pop card">
                  {(account.data?.near ?? 0n) < GAS_NEEDED && (
                    <button onClick={() => (setOpen(false), void gas.run())} disabled={gas.pending}>
                      Get testnet NEAR for gas
                    </button>
                  )}
                  <button onClick={() => (setOpen(false), faucet.run())} disabled={!faucet.ready} title={faucet.needsGas ? "Get testnet NEAR for gas first" : undefined}>
                    Get 1,000 test {meta.data?.symbol ?? "dollars"}
                  </button>
                  <a href={`${EXPLORER_URL}/address/${wallet.accountId}`} target="_blank" rel="noreferrer">
                    View account on NearBlocks
                  </a>
                  <button onClick={() => (setOpen(false), void wallet.signOut())}>Sign out</button>
                </div>
              )}
            </div>
          </>
        ) : wallet.failed ? (
          <button className="btn primary" onClick={() => window.location.reload()}>
            Reload to connect wallet
          </button>
        ) : (
          <>
            <GasFirst />
            <button className="btn primary" onClick={wallet.signIn} disabled={!wallet.ready}>
              Connect wallet
            </button>
          </>
        )}
      </div>
    </header>
  );
}

/** A NEAR testnet account name, as the bot's faucet accepts it: name.testnet, or a 64-digit implicit account. */
const isTestnetName = (id: string) => /^[0-9a-f]{64}$/.test(id) || (id.length <= 64 && /^([a-z0-9]+[-_])*[a-z0-9]+(\.([a-z0-9]+[-_])*[a-z0-9]+)*\.testnet$/.test(id));

/** Connecting a wallet costs a little gas (Meteor adds a sign-in key), which a brand-new wallet does not have, and the
 * faucet in the trade panel only shows once connected. So before connecting, anyone can ask the faucet for gas by
 * typing their account's name. */
function GasFirst() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const id = name.trim().toLowerCase();
  const gas = useGasFaucet(isTestnetName(id) ? id : null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  return (
    <div className="menu" ref={box}>
      <button className="btn gas-first" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="gas-long">New wallet? Get free gas</span>
        <span className="gas-short">Free gas</span>
      </button>
      {open && (
        <form
          className="menu-pop card gas-pop"
          onSubmit={(e) => {
            e.preventDefault();
            if (isTestnetName(id)) void gas.run();
          }}
        >
          <p className="small">Connecting costs a tiny bit of testnet NEAR, and a new wallet has none. Type your account and we send 0.25 NEAR, free.</p>
          <input className="input" placeholder="yourname.testnet" value={name} onChange={(e) => setName(e.target.value)} autoFocus spellCheck={false} autoCapitalize="none" />
          <button className="btn primary block" type="submit" disabled={!isTestnetName(id) || gas.pending}>
            {gas.pending ? "Sending…" : "Send 0.25 testnet NEAR"}
          </button>
        </form>
      )}
    </div>
  );
}
