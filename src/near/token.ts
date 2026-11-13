/** The collateral, a NEP-141 token. On testnet it is tUSD, which has an open faucet. */
import { actionCreators } from "@near-js/transactions";
import { view } from "./rpc";
import type { Tx } from "./aimm";

export interface TokenMeta {
  symbol: string;
  decimals: number;
}

/** The token's symbol and decimals, checked: a question can name any token, and a token can report anything, so a
 * symbol that is not short text or decimals outside 0 to 24 are refused rather than shown or computed with. */
export function checkMeta(token: string, m: unknown): TokenMeta {
  const { symbol, decimals } = (m ?? {}) as { symbol?: unknown; decimals?: unknown };
  if (typeof decimals !== "number" || !Number.isInteger(decimals) || decimals < 0 || decimals > 24) {
    throw new Error(`${token} reports ${String(decimals)} decimals, not a whole number from 0 to 24`);
  }
  if (typeof symbol !== "string" || symbol.length === 0 || symbol.length > 16) {
    throw new Error(`${token} reports no short symbol`);
  }
  return { symbol, decimals };
}

export async function tokenMeta(token: string): Promise<TokenMeta> {
  return checkMeta(token, await view<unknown>(token, "ft_metadata"));
}

export async function tokenBalance(token: string, accountId: string): Promise<bigint> {
  return BigInt(await view<string>(token, "ft_balance_of", { account_id: accountId }));
}

/** Whether the account can hold the token: NEP-141 needs a storage deposit first, or payouts to it are kept pending. */
export async function isRegistered(token: string, accountId: string): Promise<boolean> {
  return (await view<unknown>(token, "storage_balance_of", { account_id: accountId })) !== null;
}

export async function registrationCost(token: string): Promise<bigint> {
  return BigInt((await view<{ min: string }>(token, "storage_balance_bounds")).min);
}

/** Registers the account if it needs it, then mints `amount` from the test faucet, in one transaction. */
export function faucetTx(token: string, amount: bigint, register: bigint | null): Tx {
  const TGAS = 10n ** 12n;
  return {
    receiverId: token,
    actions: [
      ...(register === null ? [] : [actionCreators.functionCall("storage_deposit", { registration_only: true }, 30n * TGAS, register)]),
      actionCreators.functionCall("faucet", { amount: amount.toString() }, 30n * TGAS, 0n),
    ],
  };
}
