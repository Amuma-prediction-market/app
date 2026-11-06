/** Read-only access to NEAR over JSON-RPC. Reads need no wallet and no library: a view call is one POST. */
import { ARCHIVAL_RPC_URL, RPC_URL } from "../config";

export class RpcError extends Error {}

/** A block to read at: the latest one the node knows, or a past height (archival nodes only). */
export type At = { finality: "optimistic" } | { block_id: number };
export const LATEST: At = { finality: "optimistic" };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(text: string): string {
  let bin = "";
  for (const b of encoder.encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
}

async function post<T>(url: string, method: string, params: unknown, signal?: AbortSignal): Promise<T> {
  // public RPC nodes rate-limit (HTTP 429), and a 429 often carries no CORS header, so the browser reports it as a
  // network error: back off on either a few times before giving up
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "aimm", method, params }),
        signal,
      });
    } catch (e) {
      if (signal?.aborted || attempt >= 4) throw e;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      continue;
    }
    if (res.status === 429 && attempt < 4) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      continue;
    }
    // nodes send JSON-RPC errors with HTTP 500 too, so read the body before the status
    type Body = { result?: T & { error?: string }; error?: { cause?: { name?: string; info?: unknown }; data?: unknown; message?: string } };
    const body = (await res.json().catch(() => null)) as Body | null;
    // no JSON answer is a failure to reach the node, not an answer from it
    if (!body || (!res.ok && !body.error)) throw new Error(`${method}: HTTP ${res.status}`);
    if (body.error) {
      const info = body.error.cause?.info ? ` ${JSON.stringify(body.error.cause.info)}` : "";
      throw new RpcError(`${method}: ${body.error.cause?.name ?? body.error.message ?? "error"}${info}`);
    }
    if (body.result && typeof body.result === "object" && "error" in body.result && body.result.error) {
      throw new RpcError(body.result.error);
    }
    return body.result as T;
  }
}

/** The archival node allows only a few dozen requests a minute, so its reads wait their turn, a second apart. */
const ARCHIVAL_SPACING_MS = 1_000;
let archivalTurn = Promise.resolve();

function archival<T>(method: string, params: unknown, signal?: AbortSignal): Promise<T> {
  const turn = archivalTurn.then(() => post<T>(ARCHIVAL_RPC_URL, method, params, signal));
  archivalTurn = turn.then(
    () => new Promise((r) => setTimeout(r, ARCHIVAL_SPACING_MS)),
    () => new Promise((r) => setTimeout(r, ARCHIVAL_SPACING_MS)),
  );
  return turn;
}

/** Reads at a past block: the regular node keeps the last two days or so, and only older blocks go to the archival
 * node. The latest block always comes from the regular node. */
async function past<T>(method: string, params: { [k: string]: unknown }, at: At, signal?: AbortSignal): Promise<T> {
  if (!("block_id" in at)) return post<T>(RPC_URL, method, { ...params, ...at }, signal);
  try {
    return await post<T>(RPC_URL, method, { ...params, ...at }, signal);
  } catch (e) {
    if (!(e instanceof RpcError) || !/GARBAGE_COLLECTED/i.test(e.message)) throw e;
    return archival<T>(method, { ...params, ...at }, signal);
  }
}

/** Calls a view method and parses its JSON result, at the latest block or a past one. */
export async function view<T>(contract: string, method: string, args: object = {}, at: At = LATEST, signal?: AbortSignal): Promise<T> {
  const result = await past<{ result: number[] }>(
    "query",
    { request_type: "call_function", account_id: contract, method_name: method, args_base64: toBase64(JSON.stringify(args)) },
    at,
    signal,
  );
  return JSON.parse(decoder.decode(new Uint8Array(result.result))) as T;
}

/** The account's spendable NEAR, in yoctoNEAR, or null if the account does not exist. */
export async function nearBalance(accountId: string): Promise<bigint | null> {
  try {
    const r = await post<{ amount: string }>(RPC_URL, "query", { request_type: "view_account", account_id: accountId, finality: "optimistic" });
    return BigInt(r.amount);
  } catch (e) {
    if (e instanceof RpcError && /UNKNOWN_ACCOUNT|does not exist/i.test(e.message)) return null;
    throw e;
  }
}

export interface BlockHeader {
  height: number;
  /** nanoseconds */
  timestamp: number;
}

/** A block's height and time. */
export async function block(at: At): Promise<BlockHeader> {
  const r = await past<{ header: { height: number; timestamp_nanosec: string } }>("block", {}, at);
  return { height: r.header.height, timestamp: Number(r.header.timestamp_nanosec) };
}
