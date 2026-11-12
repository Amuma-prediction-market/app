/** Every read the UI makes, as React Query hooks: cached, deduplicated, and refreshed while the page is open. */
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { REFRESH_MS } from "../config";
import { getQuestion, holdings, pendingOf, phaseOf, questionCount, type Question } from "../near/aimm";
import { nearBalance } from "../near/rpc";
import { isRegistered, registrationCost, tokenBalance, tokenMeta } from "../near/token";
import { loadHistory } from "../lib/history";
import { splitTitle } from "../lib/format";
import { polymarketHistory, polymarketPrices, slugFor } from "../lib/polymarket";

/** Every question. Reading them all is one call per question, so the list refreshes only where it is shown. */
export function useQuestions(live = true) {
  return useQuery({
    queryKey: ["questions"],
    queryFn: async () => {
      const n = await questionCount();
      const all = await Promise.all(Array.from({ length: n }, (_, i) => getQuestion(i + 1)));
      return all.reverse();
    },
    refetchInterval: live ? 60_000 : false,
    staleTime: live ? 2_000 : Infinity,
  });
}

export function useQuestion(id: number) {
  return useQuery({ queryKey: ["question", id], queryFn: () => getQuestion(id), refetchInterval: REFRESH_MS });
}

export function useTokenMeta(token: string | undefined) {
  return useQuery({ queryKey: ["meta", token], queryFn: () => tokenMeta(token!), enabled: !!token, staleTime: Infinity });
}

export function useAccount(token: string | undefined, accountId: string | null) {
  return useQuery({
    queryKey: ["account", token, accountId],
    queryFn: async () => {
      const [balance, registered, near, cost] = await Promise.all([
        tokenBalance(token!, accountId!),
        isRegistered(token!, accountId!),
        nearBalance(accountId!),
        registrationCost(token!),
      ]);
      return { balance, registered, near: near ?? 0n, registrationCost: cost };
    },
    enabled: !!token && !!accountId,
    refetchInterval: REFRESH_MS * 2,
  });
}

export function useHoldings(id: number, accountId: string | null) {
  return useQuery({
    queryKey: ["holdings", id, accountId],
    queryFn: async () => {
      const [h, pending] = await Promise.all([holdings(id, accountId!), pendingOf(id, accountId!)]);
      return { ...h, pending };
    },
    enabled: !!accountId,
    refetchInterval: REFRESH_MS,
  });
}

export function usePolymarket(q: Question | undefined) {
  const slug = q ? slugFor(q.title, q.closeTime) : null;
  const live = q ? phaseOf(q) === "trading" : false;
  return useQuery({
    queryKey: ["polymarket", slug],
    queryFn: ({ signal }) => polymarketPrices(slug!, q!.answers, signal),
    enabled: !!slug && live,
    refetchInterval: 30_000,
    retry: 1,
  });
}

export function useHistory(q: Question | undefined) {
  const live = q ? phaseOf(q) === "trading" : false;
  return useQuery({
    queryKey: ["history", q?.id],
    // a live question's recent blocks come from the regular node, which allows many more reads than the archival one
    // the signal stops the reads when the page is left, so the next market's chart does not wait behind them
    queryFn: ({ signal }) => loadHistory(q!.id, q!.closeTime, live ? 48 : 20, signal),
    enabled: !!q && q.opened,
    // a settled question's past never changes; a live one gains a point now and then. After a failure both try again
    // on a timer, as the page promises
    staleTime: live ? 120_000 : Infinity,
    refetchInterval: (query) => (live || query.state.status === "error" ? 120_000 : false),
    // a failure is most likely the archival node's rate limit: try again in a minute rather than at once
    retry: 2,
    retryDelay: 60_000,
  });
}

/** The time now, refreshed every `ms`, for countdowns and the trading phase. */
export function useNow(ms = 1_000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Polymarket's price history for one answer over the chart's time span. Replays ran on chain long after the real
 * trading, so their times do not line up with Polymarket's and they get none. */
export function usePolymarketHistory(q: Question | undefined, answer: number, from: number | undefined, to: number | undefined) {
  const slug = q && !splitTitle(q.title).replay ? slugFor(q.title, q.closeTime) : null;
  const label = q?.answers[answer];
  return useQuery({
    queryKey: ["polymarketHistory", slug, label, from && Math.floor(from / 600_000), to && Math.floor(to / 120_000)],
    queryFn: ({ signal }) => polymarketHistory(slug!, label!, from!, to!, signal),
    enabled: !!slug && !!label && !!from && !!to,
    staleTime: 120_000,
    retry: 1,
  });
}
