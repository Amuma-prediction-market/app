/** The wallet SDKs, loaded on their own after the page renders: they are most of the app's weight, and nobody needs
 * them to read a market. */
import "./polyfill";
import { setupWalletSelector } from "@near-wallet-selector/core";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import { setupModal } from "@near-wallet-selector/modal-ui";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import "@near-wallet-selector/modal-ui/styles.css";
import { AIMM_CONTRACT, NETWORK } from "../config";

/** Made once per page: the selector and its modal each keep global state, and a second copy cannot show. */
let made: ReturnType<typeof make> | null = null;

export function createSelector() {
  made ??= make();
  return made;
}

async function make() {
  const selector = await setupWalletSelector({
    network: NETWORK,
    modules: [setupMyNearWallet(), setupMeteorWallet()],
  });
  // no limited-access key: every AIMM call that moves money needs 1 yoctoNEAR, which only the wallet can approve
  const modal = setupModal(selector, { contractId: AIMM_CONTRACT, description: "Sign in to trade AIMM's weather questions on NEAR testnet." });
  return { selector, modal };
}
