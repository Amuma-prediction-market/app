import { useEffect, useRef, useState } from "react";
import { EXPLORER_URL } from "../config";
import { useAccount, useTokenMeta } from "../hooks/data";
import { useFaucet } from "../hooks/useFaucet";
import { GAS_NEEDED, isEthAccount, useGasFaucet } from "../hooks/useGasFaucet";
import { formatUnits } from "../lib/units";
import { shortAccount } from "../lib/format";
import { hasInjectedWallet, isPhone, metaMaskAppLink, useWallet } from "../near/wallet";

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
                  {isEthAccount(wallet.accountId) && (account.data?.near ?? 0n) < GAS_NEEDED && (
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
            {/* A phone browser has no MetaMask in it, and the wallet list cannot say so (its descriptions are hidden),
                so offer the MetaMask app's own browser here. Meteor still works from the Connect button. */}
            {isPhone() && !hasInjectedWallet() && (
              <a
                className="small"
                href={metaMaskAppLink()}
                // the routes live in the hash, so take the page the user is on when they tap, not when this rendered
                onClick={(e) => (e.currentTarget.href = metaMaskAppLink())}
                title="Opens this page in the MetaMask app's browser"
              >
                Open in MetaMask
              </a>
            )}
            <button className="btn primary" onClick={wallet.signIn} disabled={!wallet.ready}>
              Connect wallet
            </button>
          </>
        )}
      </div>
    </header>
  );
}
