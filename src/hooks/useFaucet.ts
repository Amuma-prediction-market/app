import { useAccount, useTokenMeta } from "./data";
import { useTransaction } from "./useTransaction";
import { faucetTx } from "../near/token";
import { useWallet } from "../near/wallet";

/** Mints 1,000 test dollars to the signed-in account, registering it with the token first if it needs that. */
export function useFaucet(token: string | undefined) {
  const wallet = useWallet();
  const meta = useTokenMeta(token);
  const account = useAccount(token, wallet.accountId);
  const tx = useTransaction();
  const ready = !!token && !!meta.data && !!account.data && !tx.pending;
  const run = () => {
    if (!ready) return;
    const amount = 1_000n * 10n ** BigInt(meta.data!.decimals);
    void tx.run([faucetTx(token!, amount, account.data!.registered ? null : account.data!.registrationCost)], null, () => `1,000 ${meta.data!.symbol} are in your account.`);
  };
  return { ready, run, pending: tx.pending };
}
