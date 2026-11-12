/** Text for people: the city a question is about, its short title, and how long until a time. */

export function cityOf(title: string): string | null {
  return title.match(/^Highest temperature in (.+?) on /)?.[1] ?? null;
}

/** The cities the site trades, each on its own page: `slug` is its address (#/new-york), `inTitle` how the question
 * titles name it. */
export const CITIES = [
  { slug: "new-york", name: "New York", inTitle: "NYC" },
  { slug: "london", name: "London", inTitle: "London" },
] as const;
export type City = (typeof CITIES)[number];

export const cityBySlug = (slug: string): City | null => CITIES.find((c) => c.slug === slug) ?? null;

/** The site's city for a question title, or null for a question about something else. */
export const cityOfTitle = (title: string): City | null => {
  const named = cityOf(title);
  return CITIES.find((c) => c.inTitle === named) ?? null;
};

/** The title as people read it: without the replay note, with the city's own name ("New York", not the contract's
 * "NYC"), plus the day it is about ("November 11") and whether it was a replay of past Polymarket trading. */
export function splitTitle(title: string): { title: string; date: string | null; replay: boolean } {
  const m = title.match(/^(.*?)\s*\((replay[^)]*)\)\s*$/i);
  const bare = m ? m[1]! : title;
  const city = cityOfTitle(bare);
  const shown = city ? bare.replace(`in ${city.inTitle} on `, `in ${city.name} on `) : bare;
  const date = bare.match(/^Highest temperature in .+? on (.+?)\??$/)?.[1] ?? null;
  return { title: shown, date, replay: !!m };
}

export function timeLeft(ms: number): string {
  if (ms <= 0) return "now";
  const m = Math.floor(ms / 60_000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${Math.max(1, m)}m`;
}

export function dateTime(ms: number): string {
  return new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
}

export function shortAccount(id: string): string {
  return id.length > 22 ? `${id.slice(0, 10)}…${id.slice(-8)}` : id;
}
