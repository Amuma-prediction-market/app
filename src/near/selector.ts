/** The wallet SDKs, loaded on their own after the page renders: they are most of the app's weight, and nobody needs
 * them to read a market. */
import "./polyfill";
import { setupWalletSelector } from "@near-wallet-selector/core";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import { setupModal } from "@near-wallet-selector/modal-ui";
import "@near-wallet-selector/modal-ui/styles.css";
import { AIMM_CONTRACT, EXPLORER_URL, NETWORK, RPC_URL } from "../config";

/** Made once per page: the selector and its modal each keep global state, and a second copy cannot show. */
let made: ReturnType<typeof make> | null = null;

export function createSelector() {
  // a failed attempt is forgotten, so the next call tries again instead of getting the same failure back
  made ??= make().catch((e: unknown) => {
    made = null;
    throw e;
  });
  return made;
}

/** Meteor only. MetaMask (NEAR's Ethereum-wallet module) was taken out: MetaMask's own scanner shows every user a scam
 * warning for NEAR's Ethereum-compatible chain, which the site cannot turn off. */
async function make() {
  const selector = await setupWalletSelector({
    // the default testnet node, rpc.testnet.near.org, is deprecated and refuses most requests
    network: { networkId: NETWORK, nodeUrl: RPC_URL, helperUrl: "", explorerUrl: EXPLORER_URL, indexerUrl: "" },
    modules: [setupMeteorWallet()],
  });
  // no limited-access key: every AIMM call that moves money needs 1 yoctoNEAR, which only the wallet can approve
  const modal = setupModal(selector, { contractId: AIMM_CONTRACT, description: "Sign in to trade on Amuma, on NEAR testnet." });
  return { selector, modal };
}
