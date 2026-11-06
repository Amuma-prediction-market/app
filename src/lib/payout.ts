/** What a winning token is paid: min(1, pot ÷ the tokens that win), the same for every winner whenever it was bought.
 * These estimate it after a trade, so the trade form can say what the buyer would be paid. */
import { WAD } from "./units";
import type { Question } from "../near/aimm";

/** The tokens that pay if `answer` wins: YES on it, and NO on every other answer. */
export function winningSupply(q: Question, answer: number): bigint {
  return q.yesSupply[answer]! + q.noSupply.reduce((s, x, j) => (j === answer ? s : s + x), 0n);
}

export function payoutRate(pot: bigint, owed: bigint): bigint {
  return owed === 0n || pot >= owed ? WAD : (pot * WAD) / owed;
}

/** The payout per winning token after buying `tokens` YES (or NO) on `range` for `cost` into the pot. For a NO it is
 * the lowest over the answers it pays on, since any of them can win. */
export function payoutAfterBuy(q: Question, range: number, yes: boolean, tokens: bigint, cost: bigint): bigint {
  const pot = q.pot + cost;
  const add = (j: number) => (yes ? (j === range ? tokens : 0n) : j === range ? 0n : tokens);
  const answers = yes ? [range] : q.answers.map((_, j) => j).filter((j) => j !== range);
  return answers.map((j) => payoutRate(pot, winningSupply(q, j) + add(j))).reduce((a, b) => (b < a ? b : a), WAD);
}
