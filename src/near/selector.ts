/** The wallet SDKs, loaded on their own after the page renders: they are most of the app's weight, and nobody needs
 * them to read a market. */
import "./polyfill";
import { setupWalletSelector } from "@near-wallet-selector/core";
import { setupEthereumWallets } from "@near-wallet-selector/ethereum-wallets";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import { setupModal } from "@near-wallet-selector/modal-ui";
import "@near-wallet-selector/modal-ui/styles.css";
import { createConfig, http, injected } from "@wagmi/core";
import { defineChain } from "viem";
import { AIMM_CONTRACT, ETH_RPC_URL, EXPLORER_URL, NETWORK, RPC_URL } from "../config";

/** NEAR as an Ethereum chain (NEP-518): MetaMask signs an Ethereum transaction, NEAR's relayer runs it as the NEAR
 * account 0x<address>. Chain 398 is testnet, 397 mainnet. */
const nearChain = defineChain({
  id: NETWORK === "mainnet" ? 397 : 398,
  name: NETWORK === "mainnet" ? "NEAR Protocol" : "NEAR Protocol Testnet",
  nativeCurrency: { decimals: 18, name: "NEAR", symbol: "NEAR" },
  rpcUrls: { default: { http: [ETH_RPC_URL] } },
  blockExplorers: { default: { name: "NearBlocks", url: EXPLORER_URL } },
  testnet: NETWORK !== "mainnet",
});

/** Made once per page: the selector and its modal each keep global state, and a second copy cannot show. */
let made: ReturnType<typeof make> | null = null;

export function createSelector() {
  made ??= make();
  return made;
}

async function make() {
  const wagmiConfig = createConfig({
    chains: [nearChain],
    transports: { [nearChain.id]: http() } as Record<typeof nearChain.id, ReturnType<typeof http>>,
    connectors: [injected({ shimDisconnect: true })],
  });
  const selector = await setupWalletSelector({
    // the default testnet node, rpc.testnet.near.org, is deprecated and refuses most requests
    network: { networkId: NETWORK, nodeUrl: RPC_URL, helperUrl: "", explorerUrl: EXPLORER_URL, indexerUrl: "" },
    modules: [
      setupMeteorWallet(),
      setupEthereumWallets({
        wagmiConfig,
        nearNodeUrl: RPC_URL,
        // the relayer's key is added for free at sign-in, so the first trade is one approval, not two
        alwaysOnboardDuringSignIn: true,
        // no sign-in key: adding one costs NEAR that a new MetaMask account does not have yet
        skipSignInAccessKey: true,
      }),
    ],
  });
  // no limited-access key: every AIMM call that moves money needs 1 yoctoNEAR, which only the wallet can approve
  const modal = setupModal(selector, { contractId: AIMM_CONTRACT, description: "Sign in to trade AIMM's weather questions on NEAR testnet." });
  return { selector, modal };
}
