/** Polymarket's prices for the question an AIMM question mirrors, as a reference beside AIMM's own. */
import { POLYMARKET_API } from "../config";

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
}

/** Polymarket's price for each of `answers` (0..1): the bid-ask midpoint where both sides quote, else its last
 * displayed price. Answers Polymarket does not list come back null. */
export async function polymarketPrices(slug: string, answers: string[], signal?: AbortSignal): Promise<(number | null)[] | null> {
  const res = await fetch(`${POLYMARKET_API}/events?slug=${encodeURIComponent(slug)}`, { signal });
  if (!res.ok) return null;
  const events = (await res.json()) as { markets: GammaMarket[]; closed?: boolean }[];
  const event = events[0];
  if (!event || event.closed) return null;
  const byLabel = new Map(event.markets.map((m) => [m.groupItemTitle, m]));
  return answers.map((a) => {
    const m = byLabel.get(a);
    if (!m) return null;
    if (m.bestBid != null && m.bestAsk != null) return (Number(m.bestBid) + Number(m.bestAsk)) / 2;
    const p = m.outcomePrices ? (JSON.parse(m.outcomePrices) as string[])[0] : undefined;
    return p === undefined ? null : Number(p);
  });
}
