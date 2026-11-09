/** A question's price history, read from the chain itself: the contract's state at past blocks, from an archival node.
 * No indexer and no server, so every point can be checked by anyone with the block height. */
import { getQuestion } from "../near/aimm";
import { block, LATEST, RpcError } from "../near/rpc";

export interface HistoryPoint {
  /** milliseconds */
  time: number;
  height: number;
  prices: bigint[];
  intervals: [bigint, bigint][];
}

/** Readings across the window to find the opening, then readings across the open stretch for the chart. */
const SCAN = 8;
const CONCURRENCY = 2;
/** Pause after each read, to stay well inside a public node's rate limit. */
const SPACING_MS = 250;
/** Readings land on multiples of this many blocks (about ten minutes), so a reload or a retry asks for heights it has
 * already kept. */
const GRID = 600;
/** How far before the close to look for the opening: these questions open at most a few days ahead. */
const WINDOW_MS = 4 * 86_400_000;

type Reading = { prices: string[]; intervals: [string, string][] } | null;

/** A past block's state never changes, so each reading is kept in the browser and never asked for twice. */
function cached(id: number, height: number): Reading | undefined {
  try {
    const v = localStorage.getItem(`aimm:h:${id}:${height}`);
    return v === null ? undefined : (JSON.parse(v) as Reading);
  } catch {
    return undefined;
  }
}

function keep(id: number, height: number, r: Reading) {
  try {
    localStorage.setItem(`aimm:h:${id}:${height}`, JSON.stringify(r));
  } catch {
    // storage full or blocked: the reading is fetched again next time
  }
}

/** The question's prices at a height, or null when it did not exist or was not open there. A height the chain skipped
 * is tried at the next one. A network failure throws, so it is never mistaken for "not open". */
async function readingAt(id: number, height: number): Promise<{ height: number; r: Reading }> {
  for (let h = height; h < height + 4; h++) {
    const hit = cached(id, h);
    if (hit !== undefined) return { height: h, r: hit };
    try {
      const q = await getQuestion(id, { block_id: h });
      const r: Reading = q.opened && q.prices.length ? { prices: q.prices.map(String), intervals: q.intervals.map(([a, b]) => [String(a), String(b)]) } : null;
      keep(id, h, r);
      return { height: h, r };
    } catch (e) {
      if (e instanceof RpcError && /UNKNOWN_BLOCK|DB Not Found/i.test(e.message)) continue;
      // only "not there yet" is an answer: the contract saying so, or the node holding no state that far back
      // (MissingTrieValue); anything else is a failure to read
      if (!(e instanceof RpcError) || !/no such question|GuestPanic|CodeDoesNotExist|MethodNotFound|MissingTrieValue/i.test(e.message)) throw e;
      keep(id, h, null);
      return { height: h, r: null };
    }
  }
  return { height, r: null };
}

async function pool<T, R>(items: T[], f: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await f(items[i]!);
        await new Promise((r) => setTimeout(r, SPACING_MS));
      }
    }),
  );
  return out;
}

const snap = (h: number) => Math.floor(h / GRID) * GRID;
const spread = (a: number, b: number, n: number) => [...new Set(Array.from({ length: n }, (_, i) => snap(a + ((b - a) * i) / (n - 1))))];
/** About `n` heights from `a` to `b` on fixed multiples of a step, so that as `b` moves on, the heights already read stay
 * the same and come from the cache. */
const steps = (a: number, b: number, n: number) => {
  const step = Math.max(GRID, Math.ceil((b - a) / n / GRID) * GRID);
  const out: number[] = [];
  for (let h = Math.ceil(a / step) * step; h <= b; h += step) out.push(h);
  return out;
};

/** A block at or just after `height`: the chain skips a height now and then. */
async function blockNear(height: number) {
  for (let h = height; ; h++) {
    try {
      return await block({ block_id: h });
    } catch (e) {
      if (!(e instanceof RpcError) || !/UNKNOWN_BLOCK/i.test(e.message) || h > height + 3) throw e;
    }
  }
}

/** About `samples` evenly spaced readings from the question's opening to its close, or to now while it trades. */
export async function loadHistory(id: number, closeTime: number, samples: number): Promise<HistoryPoint[]> {
  const latest = await block(LATEST);
  // the block rate from a day's worth of blocks; times are interpolated from it, close enough for a chart's axis
  const earlier = await blockNear(snap(latest.height - 86_400));
  const msPerBlock = (latest.timestamp - earlier.timestamp) / 1e6 / (latest.height - earlier.height);
  const heightAt = (ms: number) => Math.round(latest.height - (latest.timestamp / 1e6 - ms) / msPerBlock);
  const timeAt = (h: number) => latest.timestamp / 1e6 - (latest.height - h) * msPerBlock;

  // trading stops at the close, and once the result is in the contract no longer reports prices
  const live = latest.height - 2 < heightAt(closeTime) - 1;
  const end = snap(Math.min(latest.height - 2, heightAt(closeTime) - 1));
  const scan = await pool(spread(Math.max(1, end - Math.round(WINDOW_MS / msPerBlock)), end, SCAN), (h) => readingAt(id, h));
  const first = scan.findIndex((s) => s.r !== null);
  if (first < 0) return [];

  // narrow the opening down between the last closed reading and the first open one, to within half a sample's width:
  // a question that opened an hour ago needs as fine a start as one that opened days ago
  let lo = first > 0 ? scan[first - 1]!.height : scan[0]!.height;
  let hi = scan[first]!.height;
  for (let k = 0; k < 20 && first > 0 && hi - lo > Math.max(1, (end - lo) / (2 * samples)); k++) {
    const mid = Math.floor((lo + hi) / 2);
    if ((await readingAt(id, mid)).r) hi = mid;
    else lo = mid;
  }

  // while it trades, the chart runs up to the newest block
  const heights = [hi, ...steps(hi, end, samples).filter((h) => h > hi), ...(live && latest.height - 2 > end ? [latest.height - 2] : [])];
  const readings = await pool(heights, (h) => readingAt(id, h));
  return readings
    .filter((s): s is { height: number; r: NonNullable<Reading> } => s.r !== null)
    .map(({ height, r }) => ({
      time: timeAt(height),
      height,
      prices: r.prices.map(BigInt),
      intervals: r.intervals.map(([a, b]) => [BigInt(a), BigInt(b)] as [bigint, bigint]),
    }));
}
