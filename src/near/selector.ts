/** The wallet SDKs, loaded on their own after the page renders: they are most of the app's weight, and nobody needs
 * them to read a market. */
import "./polyfill";
import { setupWalletSelector, type InjectedWallet, type WalletModuleFactory } from "@near-wallet-selector/core";
import { setupEthereumWallets } from "@near-wallet-selector/ethereum-wallets";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import { setupModal } from "@near-wallet-selector/modal-ui";
import "@near-wallet-selector/modal-ui/styles.css";
import { createConfig, http, injected } from "@wagmi/core";
import { defineChain } from "viem";
import { AIMM_CONTRACT, ETH_RPC_URL, EXPLORER_URL, NETWORK, RPC_URL } from "../config";
import { hasInjectedWallet, isPhone, metaMaskAppLink } from "./wallet";

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
  // a failed attempt is forgotten, so the next call tries again instead of getting the same failure back
  made ??= make().catch((e: unknown) => {
    made = null;
    throw e;
  });
  return made;
}

/** The library lists itself as "Ethereum Wallet" and always as available. Here it is named for MetaMask, as the rest of
 * the site is, and it is available only when the browser has a wallet in it (window.ethereum). Without one, choosing it
 * opens the selector's own "install" page, whose button goes to MetaMask: on a phone, a link that opens this site
 * inside the MetaMask app's browser, where it works. (The list's per-wallet description is hidden by the modal's own
 * styles, so the site explains this next to the Connect button instead; see Header.) */
function asMetaMask(factory: WalletModuleFactory<InjectedWallet>): WalletModuleFactory<InjectedWallet> {
  return async (options) => {
    const module = await factory(options);
    if (!module) return module;
    return {
      ...module,
      metadata: {
        ...module.metadata,
        name: "MetaMask",
        available: hasInjectedWallet(),
        // a getter: the modal reads it when the button is pressed, so the link carries the page the user is on then
        get downloadUrl() {
          return isPhone() ? metaMaskAppLink() : "https://metamask.io/download/";
        },
      },
    };
  };
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
      asMetaMask(
        setupEthereumWallets({
          wagmiConfig,
          // typed as a string, but the module hands it straight to `new JsonRpcProvider(...)`, which wants { url }: a bare
          // string leaves the URL undefined and every sign-in fails with "Failed to view the relayer public key"
          nearNodeUrl: { url: RPC_URL } as unknown as string,
          // the relayer's key is added for free at sign-in, so the first trade is one approval, not two
          alwaysOnboardDuringSignIn: true,
          // no sign-in key: adding one costs NEAR that a new MetaMask account does not have yet
          skipSignInAccessKey: true,
        }),
      ),
    ],
  });
  // no limited-access key: every AIMM call that moves money needs 1 yoctoNEAR, which only the wallet can approve
  const modal = setupModal(selector, { contractId: AIMM_CONTRACT, description: "Sign in to trade Amuma's weather questions on NEAR testnet." });
  return { selector, modal };
}
