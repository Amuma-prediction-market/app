/** The wallet SDKs were written for Node: they use Buffer and read process.env. Imported before them, so both are there
 * when they load. */
import { Buffer } from "buffer";

const g = globalThis as typeof globalThis & { Buffer?: typeof Buffer; process?: { env: Record<string, string | undefined> } };
g.Buffer ??= Buffer;
g.process ??= { env: {} };
