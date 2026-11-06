/** Estimates for the trade form. The contract's quote is the authority; these only turn an amount of money into a
 * number of tokens to ask it about, because `quote_buy` takes tokens, and people think in dollars.
 *
 * AIMM prices with Hanson's curve C(q) = b ln Σ exp(q_i / b). Buying t YES on answer i adds t to q_i, so at price p
 * it costs b ln(1 − p + p e^{t/b}). A NO on i adds t to every other answer and costs b ln(p + (1 − p) e^{t/b}). */

/** The cost of `tokens`, at price `p` (0..1) and depth `b`, both in the same unit as the money. */
export function costOf(tokens: number, p: number, b: number, yes: boolean): number {
  const g = Math.exp(tokens / b);
  return b * Math.log(yes ? 1 - p + p * g : p + (1 - p) * g);
}

/** How many tokens `spend` buys at price `p` and depth `b`: the inverse of `costOf`. */
export function tokensFor(spend: number, p: number, b: number, yes: boolean): number {
  if (spend <= 0) return 0;
  const q = yes ? p : 1 - p; // the price of the side bought
  return b * Math.log((Math.exp(spend / b) - 1 + q) / q);
}
