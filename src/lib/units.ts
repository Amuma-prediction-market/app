/** Fixed-point helpers. The contract counts prices and payouts in WAD (1e18 = 1) and money and tokens in the
 * collateral's smallest unit; everything here stays in bigint until it is shown. */

export const WAD = 10n ** 18n;

/** A WAD amount as a number between 0 and 1, for display and charts only. */
export function wadToNumber(x: bigint): number {
  return Number(x) / 1e18;
}

/** Parses a decimal string such as "12.5" into units with `decimals` places. Returns null if it is not a number or
 * has more places than the token keeps. */
export function parseUnits(text: string, decimals: number): bigint | null {
  const s = text.trim();
  if (!/^\d*\.?\d*$/.test(s) || s === "" || s === ".") return null;
  const [whole = "", frac = ""] = s.split(".");
  if (frac.length > decimals) return null;
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0") || "0");
}

/** Formats units with `decimals` places as a decimal string, cut (not rounded) to `places` places. */
export function formatUnits(x: bigint, decimals: number, places = 2): string {
  const neg = x < 0n;
  const a = neg ? -x : x;
  const base = 10n ** BigInt(decimals);
  const whole = (a / base).toLocaleString("en-US");
  const frac = (a % base).toString().padStart(decimals, "0").slice(0, places);
  return `${neg ? "−" : ""}${whole}${places > 0 ? "." + frac : ""}`;
}

/** A WAD price as a percentage, "41.0%", or "<0.1%" when it is that small but not zero. */
export function formatPercent(x: bigint, places = 1): string {
  const pct = wadToNumber(x) * 100;
  if (pct > 0 && pct < 10 ** -places) return `<${(10 ** -places).toFixed(places)}%`;
  return `${pct.toFixed(places)}%`;
}

/** A WAD price as cents, "41.2¢", the way a one-dollar token is priced. */
export function formatCents(x: bigint): string {
  return `${(wadToNumber(x) * 100).toFixed(1)}¢`;
}

/** A WAD payout as dollars per one-dollar token, "$0.97". */
export function formatPayout(x: bigint): string {
  return `$${wadToNumber(x).toFixed(2)}`;
}
