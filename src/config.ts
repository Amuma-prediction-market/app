/** Where the app points. Each value can be overridden at build time with a VITE_ variable (see .env.example). */
const env = import.meta.env;

export const NETWORK = (env.VITE_NETWORK ?? "testnet") as "testnet" | "mainnet";
/** The AIMM contract: one account holds every question. */
export const AIMM_CONTRACT = env.VITE_AIMM_CONTRACT ?? "market.aimm-weather.testnet";
/** The token the demo's questions are paid in. Anyone can open a question on the contract with any token and any
 * resolver, so the site lists only the questions paid in this token and resolved by one of `RESOLVERS`. */
export const COLLATERAL = env.VITE_COLLATERAL ?? "tusd.aimm-weather.testnet";
/** The accounts trusted to report a result, as resolver and as fallback resolver. */
export const RESOLVERS: readonly string[] = (env.VITE_RESOLVERS ?? "aimm-weather-oracle.testnet")
  .split(",")
  .map((s: string) => s.trim())
  .filter(Boolean);
/** Reads of the current state. */
export const RPC_URL = env.VITE_RPC_URL ?? "https://rpc.testnet.fastnear.com";
/** Reads of past blocks, for the price history: only an archival node keeps them. (rpc.testnet.near.org and its
 * archival twin are deprecated and refuse nearly every request.) */
export const ARCHIVAL_RPC_URL = env.VITE_ARCHIVAL_RPC_URL ?? "https://archival-rpc.testnet.fastnear.com";
/** A gas faucet that sends a little testnet NEAR to an account holding almost none, set at build time. Without one the
 * site hides its "get gas" buttons and tells a new account to use its wallet's own faucet. */
export const GAS_FAUCET_URL = env.VITE_GAS_FAUCET_URL ?? "";
export const EXPLORER_URL = env.VITE_EXPLORER_URL ?? "https://testnet.nearblocks.io";
/** Polymarket's public market data, shown beside AIMM's prices for the questions this app mirrors. */
export const POLYMARKET_API = env.VITE_POLYMARKET_API ?? "https://gamma-api.polymarket.com";
/** Polymarket's order-book API, for its price history. */
export const POLYMARKET_CLOB = env.VITE_POLYMARKET_CLOB ?? "https://clob.polymarket.com";

/** How long a quote, a price or a balance is shown before it is read again. */
export const REFRESH_MS = 8_000;
