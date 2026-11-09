/** Polymarket's prices for the question an AIMM question mirrors, as a reference beside AIMM's own: the current price
 * from its event API, and the price history from its order book's API. */
import { POLYMARKET_API, POLYMARKET_CLOB } from "../config";

/** The Polymarket event slug for a title such as "Highest temperature in NYC on November 7?", or null if the title is
 * not one of Polymarket's temperature questions. The year is the one the question closes in. */
export function slugFor(title: string, closeTime: number): string | null {
  const m = title.match(/^Highest temperature in (.+?) on ([A-Z][a-z]+) (\d{1,2})\?/);
  if (!m) return null;
  const year = new Date(closeTime - 86_400_000).getUTCFullYear();
  return `highest-temperature-in-${m[1]!.toLowerCase().replace(/\s+/g, "-")}-on-${m[2]!.toLowerCase()}-${m[3]}-${year}`;
}

interface GammaMarket {
  groupItemTitle: string;
  bestBid?: number | string | null;
  bestAsk?: number | string | null;
  outcomePrices?: string;
  clobTokenIds?: string;
}

async function event(slug: string, signal?: AbortSignal): Promise<{ markets: GammaMarket[]; closed?: boolean } | null> {
  const res = await fetch(`${POLYMARKET_API}/events?slug=${encodeURIComponent(slug)}`, { signal });
  if (!res.ok) return null;
  return ((await res.json()) as { markets: GammaMarket[]; closed?: boolean }[])[0] ?? null;
}

/** Polymarket's price for each of `answers` (0..1): the bid-ask midpoint where both sides quote, else its last
 * displayed price. Answers Polymarket does not list come back null. */
export async function polymarketPrices(slug: string, answers: string[], signal?: AbortSignal): Promise<(number | null)[] | null> {
  const e = await event(slug, signal);
  if (!e || e.closed) return null;
  const byLabel = new Map(e.markets.map((m) => [m.groupItemTitle, m]));
  return answers.map((a) => {
    const m = byLabel.get(a);
    if (!m) return null;
    if (m.bestBid != null && m.bestAsk != null) return (Number(m.bestBid) + Number(m.bestAsk)) / 2;
    const p = m.outcomePrices ? (JSON.parse(m.outcomePrices) as string[])[0] : undefined;
    return p === undefined ? null : Number(p);
  });
}

export interface PricePoint {
  /** milliseconds */
  time: number;
  /** 0..1 */
  price: number;
}

/** Polymarket's traded price of `answer`'s YES between two times, a point every few minutes. */
export async function polymarketHistory(slug: string, answer: string, from: number, to: number, signal?: AbortSignal): Promise<PricePoint[]> {
  const e = await event(slug, signal);
  const m = e?.markets.find((x) => x.groupItemTitle === answer);
  const token = m?.clobTokenIds ? (JSON.parse(m.clobTokenIds) as string[])[0] : undefined;
  if (!token) return [];
  const url = `${POLYMARKET_CLOB}/prices-history?market=${token}&startTs=${Math.floor(from / 1000)}&endTs=${Math.ceil(to / 1000)}&fidelity=5`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const body = (await res.json()) as { history?: { t: number; p: number }[] };
  return (body.history ?? []).map((h) => ({ time: h.t * 1000, price: h.p }));
}
