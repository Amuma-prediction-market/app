import { useEffect, useState } from "react";
import { EXPLORER_URL } from "./config";
import { Header } from "./components/Header";
import { Home } from "./components/Home";
import { MarketPage } from "./components/MarketPage";
import { useToast } from "./components/Toasts";
import { useQuestions } from "./hooks/data";

type Route = { page: "home" } | { page: "market"; id: number };

function parse(hash: string): Route {
  const m = hash.match(/^#\/q\/(\d+)/);
  return m ? { page: "market", id: Number(m[1]) } : { page: "home" };
}

function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parse(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

/** A redirect wallet (MyNearWallet) comes back with the result in the query string; show it once, then drop it. */
function useWalletReturn() {
  const toast = useToast();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashes = params.get("transactionHashes");
    const error = params.get("errorCode");
    if (!hashes && !error) return;
    if (hashes) {
      const last = hashes.split(",").pop()!;
      toast({ text: "Transaction sent.", href: `${EXPLORER_URL}/txns/${last}`, linkText: "Check it on NearBlocks" });
    } else if (error !== "userRejected") {
      toast({ kind: "error", text: decodeURIComponent(params.get("errorMessage") ?? error ?? "The wallet reported an error") });
    }
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
  }, [toast]);
}

export function App() {
  const route = useRoute();
  // the header only needs the collateral, which never changes, so off the home page the list is read once
  const questions = useQuestions(route.page === "home");
  useWalletReturn();
  // every question uses the same collateral today; the header shows the balance in it
  const collateral = questions.data?.find((q) => q.opened)?.collateral;
  return (
    <>
      <Header collateral={collateral} />
      <main className="page">{route.page === "market" ? <MarketPage key={route.id} id={route.id} /> : <Home />}</main>
    </>
  );
}
