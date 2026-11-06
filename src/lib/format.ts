/** Text for people: the city a question is about, its short title, and how long until a time. */

export function cityOf(title: string): string | null {
  return title.match(/^Highest temperature in (.+?) on /)?.[1] ?? null;
}

/** The title without the replay note, and whether it was a replay of past Polymarket trading. */
export function splitTitle(title: string): { title: string; replay: boolean } {
  const m = title.match(/^(.*?)\s*\((replay[^)]*)\)\s*$/i);
  return m ? { title: m[1]!, replay: true } : { title, replay: false };
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
