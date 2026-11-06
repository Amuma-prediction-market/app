/** The AIMM contract's views and calls, typed. Every amount the contract returns as a string becomes a bigint here, so
 * no number is ever rounded before it is shown. */
import { actionCreators, type Action } from "@near-js/transactions";
import { AIMM_CONTRACT } from "../config";
import { LATEST, view, type At } from "./rpc";

const TGAS = 10n ** 12n;
const ONE_YOCTO = 1n;

interface QuestionJson {
  id: number;
  title: string;
  answers: string[];
  collateral: string;
  operator: string;
  resolver: string;
  fallback_resolver: string;
  close_time: string;
  resolve_after: string;
  fallback_after: string;
  fee_rate: string;
  opened: boolean;
  halted: boolean;
  resolved: boolean;
  winner: number | null;
  depth: string;
  virtual_liquidity: string;
  fund: string;
  pot: string;
  fees_paid: string;
  fees_owed: string;
  surplus: string;
  storage: string;
  prices: string[];
  intervals: [string, string][];
  payouts: string[];
  yes_supply: string[];
  no_supply: string[];
}

export interface Question {
  id: number;
  title: string;
  answers: string[];
  collateral: string;
  operator: string;
  resolver: string;
  /** milliseconds, for Date */
  closeTime: number;
  resolveAfter: number;
  feeRate: bigint;
  opened: boolean;
  halted: boolean;
  resolved: boolean;
  winner: number | null;
  /** The curve's depth b, in the collateral's smallest unit. */
  depth: bigint;
  /** L: what an AMM would have to put up to price as deep as this. */
  virtualLiquidity: bigint;
  /** ℓ: the money the operator actually put up. */
  fund: bigint;
  /** Everything that can pay winners: the fund plus what buyers paid, less what sellers and winners took. */
  pot: bigint;
  /** WAD, one per answer; empty once resolved. */
  prices: bigint[];
  /** WAD [lower, upper], one per answer: the information interval. */
  intervals: [bigint, bigint][];
  /** WAD, what a winning YES on each answer would be paid if it won now. */
  payouts: bigint[];
  yesSupply: bigint[];
  noSupply: bigint[];
}

export type Phase = "unopened" | "trading" | "halted" | "closed" | "resolved";

export function phaseOf(q: Question, now = Date.now()): Phase {
  if (q.resolved) return "resolved";
  if (!q.opened) return "unopened";
  if (q.halted) return "halted";
  return now >= q.closeTime ? "closed" : "trading";
}

const ns = (s: string) => Number(BigInt(s) / 1_000_000n);

function parseQuestion(j: QuestionJson): Question {
  return {
    id: j.id,
    title: j.title,
    answers: j.answers,
    collateral: j.collateral,
    operator: j.operator,
    resolver: j.resolver,
    closeTime: ns(j.close_time),
    resolveAfter: ns(j.resolve_after),
    feeRate: BigInt(j.fee_rate),
    opened: j.opened,
    halted: j.halted,
    resolved: j.resolved,
    winner: j.winner,
    depth: BigInt(j.depth),
    virtualLiquidity: BigInt(j.virtual_liquidity),
    fund: BigInt(j.fund),
    pot: BigInt(j.pot),
    prices: j.prices.map(BigInt),
    intervals: j.intervals.map(([lo, hi]) => [BigInt(lo), BigInt(hi)]),
    payouts: j.payouts.map(BigInt),
    yesSupply: j.yes_supply.map(BigInt),
    noSupply: j.no_supply.map(BigInt),
  };
}

export async function questionCount(): Promise<number> {
  return view<number>(AIMM_CONTRACT, "question_count");
}

export async function getQuestion(id: number, at: At = LATEST): Promise<Question> {
  return parseQuestion(await view<QuestionJson>(AIMM_CONTRACT, "get_question", { question_id: id }, at));
}

export interface Quote {
  /** The curve's cost of a buy, or the capped refund of a sale. */
  amount: bigint;
  fee: bigint;
  /** What a buyer pays in all, or what a seller receives. */
  total: bigint;
  pricesAfter: bigint[];
}

async function quote(method: "quote_buy" | "quote_sell", id: number, range: number, yes: boolean, tokens: bigint): Promise<Quote> {
  const q = await view<{ amount: string; fee: string; total: string; prices_after: string[] }>(AIMM_CONTRACT, method, {
    question_id: id,
    range,
    yes,
    tickets: tokens.toString(),
  });
  return { amount: BigInt(q.amount), fee: BigInt(q.fee), total: BigInt(q.total), pricesAfter: q.prices_after.map(BigInt) };
}

export const quoteBuy = (id: number, range: number, yes: boolean, tokens: bigint) => quote("quote_buy", id, range, yes, tokens);
export const quoteSell = (id: number, range: number, yes: boolean, tokens: bigint) => quote("quote_sell", id, range, yes, tokens);

export interface Holdings {
  yes: bigint[];
  no: bigint[];
}

export async function holdings(id: number, accountId: string): Promise<Holdings> {
  const h = await view<{ yes: string[]; no: string[] }>(AIMM_CONTRACT, "holdings", { question_id: id, account_id: accountId });
  return { yes: h.yes.map(BigInt), no: h.no.map(BigInt) };
}

/** A payout that could not be delivered, kept for its owner. */
export async function pendingOf(id: number, accountId: string): Promise<bigint> {
  return BigInt(await view<string>(AIMM_CONTRACT, "pending_of", { question_id: id, account_id: accountId }));
}

/** What a NO on `range` is paid if it wins: the lowest payout among the other answers, since any of them can win. */
export function noPayout(q: Question, range: number): bigint {
  const others = q.payouts.filter((_, j) => j !== range);
  return others.reduce((a, b) => (b < a ? b : a), others[0] ?? 0n);
}

/** What `h` is paid at settlement once `q` is resolved: YES on the winner, NO on every other answer. */
export function settlementValue(q: Question, h: Holdings): bigint {
  if (!q.resolved || q.winner === null) return 0n;
  const payout = q.payouts[q.winner] ?? 0n;
  const winning = h.yes[q.winner]! + h.no.reduce((s, x, j) => (j === q.winner ? s : s + x), 0n);
  return (winning * payout) / 10n ** 18n;
}

// ------------------------------------------------------------------------------------------------ transactions

export interface Tx {
  receiverId: string;
  actions: Action[];
}

const call = (method: string, args: object, gasTgas: bigint, deposit: bigint): Action =>
  actionCreators.functionCall(method, args, gasTgas * TGAS, deposit);

/** Buys `tokens` YES (or NO) on `range`, sending `maxCost` of collateral; the contract sends back what is not used. */
export function buyTx(q: Question, range: number, yes: boolean, tokens: bigint, maxCost: bigint): Tx {
  const msg = JSON.stringify({ action: "buy", question_id: q.id, range, yes, tickets: tokens.toString(), max_cost: maxCost.toString() });
  return {
    receiverId: q.collateral,
    actions: [call("ft_transfer_call", { receiver_id: AIMM_CONTRACT, amount: maxCost.toString(), msg }, 100n, ONE_YOCTO)],
  };
}

export function sellTx(q: Question, range: number, yes: boolean, tokens: bigint, minProceeds: bigint): Tx {
  return {
    receiverId: AIMM_CONTRACT,
    actions: [call("sell", { question_id: q.id, range, yes, tickets: tokens.toString(), min_proceeds: minProceeds.toString() }, 60n, ONE_YOCTO)],
  };
}

export function redeemTx(q: Question): Tx {
  return { receiverId: AIMM_CONTRACT, actions: [call("redeem", { question_id: q.id }, 60n, ONE_YOCTO)] };
}

export function withdrawPendingTx(q: Question): Tx {
  return { receiverId: AIMM_CONTRACT, actions: [call("withdraw_pending", { question_id: q.id }, 60n, ONE_YOCTO)] };
}
