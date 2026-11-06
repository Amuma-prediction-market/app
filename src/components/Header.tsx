import { useEffect, useRef, useState } from "react";
import { EXPLORER_URL } from "../config";
import { useAccount, useTokenMeta } from "../hooks/data";
import { useFaucet } from "../hooks/useFaucet";
import { formatUnits } from "../lib/units";
import { shortAccount } from "../lib/format";
import { useWallet } from "../near/wallet";

export function Header({ collateral }: { collateral: string | undefined }) {
  const wallet = useWallet();
  const meta = useTokenMeta(collateral);
  const account = useAccount(collateral, wallet.accountId);
  const faucet = useFaucet(collateral);
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
          AIMM <span className="faint brand-sub" style={{ fontWeight: 500 }}>Weather</span>
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
                  <button onClick={() => (setOpen(false), faucet.run())} disabled={!faucet.ready}>
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
        ) : (
          <button className="btn primary" onClick={wallet.signIn} disabled={!wallet.ready}>
            Connect wallet
          </button>
        )}
      </div>
    </header>
  );
}
