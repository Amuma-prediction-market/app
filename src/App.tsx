import { useEffect, useState } from "react";
import { EXPLORER_URL } from "./config";
import { Header } from "./components/Header";
import { CityPage } from "./components/CityPage";
import { Home } from "./components/Home";
import { MarketPage } from "./components/MarketPage";
import { useToast } from "./components/Toasts";
import { cityBySlug, type City } from "./lib/format";

type Route = { page: "home" } | { page: "city"; city: City } | { page: "market"; id: number };

/** #/q/15 is a question, #/new-york or #/london a city, anything else the city picker. */
function parse(hash: string): Route {
  const m = hash.match(/^#\/q\/(\d+)/);
  if (m) return { page: "market", id: Number(m[1]) };
  const city = cityBySlug(hash.replace(/^#\/?/, "").split(/[/?]/)[0] ?? "");
  return city ? { page: "city", city } : { page: "home" };
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

/** A wallet that signs on its own site comes back with the result in the query string; show it once, then drop it.
 * Anyone can write a link with that query string, so the wallet's own error text is never shown, only a fixed one. */
function useWalletReturn() {
  const toast = useToast();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashes = params.get("transactionHashes");
    const error = params.get("errorCode");
    if (!hashes && !error) return;
    if (hashes) {
      const last = hashes.split(",").pop()!;
      toast({ text: "Transaction sent.", href: `${EXPLORER_URL}/txns/${encodeURIComponent(last)}`, linkText: "Check it on NearBlocks" });
    } else if (error !== "userRejected") {
      toast({ kind: "error", text: "The wallet reported an error." });
    }
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
  }, [toast]);
}

export function App() {
  const route = useRoute();
  useWalletReturn();
  return (
    <>
      <Header />
      <main className="page">
        {route.page === "market" ? <MarketPage key={route.id} id={route.id} /> : route.page === "city" ? <CityPage key={route.city.slug} city={route.city} /> : <Home />}
      </main>
    </>
  );
}
