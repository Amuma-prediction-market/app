/** Fixes MetaMask sign-in. Run after every install (package.json "postinstall").
 *
 * A MetaMask account's first step on NEAR is "Onboard": it adds the relayer's key to the account, with an unlimited
 * fee allowance, which near-api-js writes as 0. @near-wallet-selector/core 10.1.4 turns that 0 into "not set", the
 * Ethereum wallet module then fills in its default of 0.25 NEAR, and NEAR's relayer refuses the transaction:
 * "account is not onboarded or key was revoked; please onboard the account first". So no MetaMask account could ever
 * sign in. This keeps the 0. 10.1.4 is the latest release, so there is no fixed version to move to.
 *
 * It stops the install if the line is not found, so an update of the library cannot silently drop the fix. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const core = join(root, "node_modules", "@near-wallet-selector", "core");
const BROKEN = "allowance: fc.allowance ? fc.allowance.toString() : undefined";
const FIXED = "allowance: fc.allowance != null ? fc.allowance.toString() : undefined";

if (!existsSync(core)) {
  // nothing installed here (for example a partial install); nothing to fix
  process.exit(0);
}

let changed = false;
for (const name of ["index.js", "index.cjs"]) {
  const file = join(core, name);
  const text = readFileSync(file, "utf8");
  if (text.includes(FIXED)) continue;
  if (!text.includes(BROKEN)) {
    console.error(`patch-wallet-selector: the line to fix is not in ${file}. The library has changed; check whether it still drops a 0 allowance, then update or remove this script.`);
    process.exit(1);
  }
  writeFileSync(file, text.replaceAll(BROKEN, FIXED));
  changed = true;
}

if (changed) {
  // the dev server keeps its own copy of the library: start it once with `npm run dev -- --force` to rebuild that copy
  console.log("patch-wallet-selector: fixed the relayer key's allowance in @near-wallet-selector/core");
}
