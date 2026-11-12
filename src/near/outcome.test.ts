import { describe, expect, it } from "vitest";
import { aimmEvents, failureOf, hashOf, signerOf, walletErrorText } from "./outcome";

const buy = {
  transaction: { hash: "4BxBf4NX" },
  receipts_outcome: [
    { outcome: { logs: ['EVENT_JSON:{"standard":"nep141","version":"1.0.0","event":"ft_transfer","data":[{}]}'], status: { SuccessReceiptId: "a" } } },
    {
      outcome: {
        logs: ['EVENT_JSON:{"standard":"aimm","version":"1.0.0","event":"buy","data":[{"id":10,"range":4,"yes":true,"tickets":"100000000","cost":"41230000","fee":"0"}]}'],
        status: { SuccessValue: "" },
      },
    },
  ],
};

const refused = {
  transaction_outcome: { id: "6yPY" },
  receipts_outcome: [
    {
      outcome: {
        logs: [],
        status: { Failure: { ActionError: { kind: { FunctionCallError: { ExecutionError: "Smart contract panicked: AIMM: cost 24792066 above max_cost" } } } } },
      },
    },
  ],
};

// a sale whose payout the token refused: AIMM's sell went through, the detached ft_transfer failed, and on_paid kept the
// money as pending
const soldIntoPending = {
  transaction: { hash: "9Qx", signer_id: "0x1111111111111111111111111111111111111111" },
  receipts_outcome: [
    {
      outcome: {
        logs: ['EVENT_JSON:{"standard":"aimm","version":"1.0.0","event":"sell","data":[{"id":10,"range":4,"yes":true,"tickets":"100","proceeds":"40"}]}'],
        status: { SuccessValue: "IjQwIg==" },
      },
    },
    {
      outcome: {
        logs: [],
        status: { Failure: { ActionError: { index: 0, kind: { FunctionCallError: { ExecutionError: "Smart contract panicked: The account 0x11 is not registered" } } } } },
      },
    },
    {
      outcome: {
        logs: ['EVENT_JSON:{"standard":"aimm","version":"1.0.0","event":"payment_failed","data":[{"id":10,"to":"0x11","amount":"40","pending":"40"}]}'],
        status: { SuccessValue: "" },
      },
    },
  ],
};

describe("outcome", () => {
  it("reads AIMM's events and ignores other standards", () => {
    const ev = aimmEvents(buy);
    expect(ev).toHaveLength(1);
    expect(ev[0]?.event).toBe("buy");
    expect(ev[0]?.data.cost).toBe("41230000");
    expect(failureOf(buy)).toBeNull();
    expect(hashOf(buy)).toBe("4BxBf4NX");
  });

  it("finds the contract's refusal", () => {
    expect(aimmEvents(refused)).toHaveLength(0);
    expect(failureOf(refused)).toBe("Amuma: cost 24792066 above max_cost");
    expect(hashOf(refused)).toBe("6yPY");
  });

  it("reads the trade and the pending payout when only the payout transfer failed", () => {
    expect(aimmEvents(soldIntoPending).map((e) => e.event)).toEqual(["sell", "payment_failed"]);
    expect(failureOf(soldIntoPending)).toBe("Smart contract panicked: The account 0x11 is not registered");
    expect(signerOf(soldIntoPending)).toBe("0x1111111111111111111111111111111111111111");
    expect(signerOf(refused)).toBeNull();
  });

  it("ignores an event logged by a receipt that then failed", () => {
    const rolledBack = { receipts_outcome: [{ outcome: { logs: [buy.receipts_outcome[1]!.outcome.logs[0]!], status: { Failure: {} } } }] };
    expect(aimmEvents(rolledBack)).toHaveLength(0);
    expect(failureOf(rolledBack)).toBe("The transaction failed");
  });
});

describe("walletErrorText", () => {
  // what MetaMask's library throws when the called contract fails: parseRpcError's message is the failure as JSON
  const nested = (panic: string) =>
    new Error(JSON.stringify({ index: 0, kind: { index: 0, kind: { FunctionCallError: { ExecutionError: `Smart contract panicked: ${panic}` } } } }));

  it("reads AIMM's reason out of a thrown contract failure, TradingClosed included", () => {
    expect(walletErrorText(nested("AIMM: TradingClosed"))).toBe("Amuma: TradingClosed");
    expect(walletErrorText(nested("AIMM: proceeds 5 below min_proceeds 6"))).toBe("Amuma: proceeds 5 below min_proceeds 6");
    expect(walletErrorText(new Error("Smart contract panicked: AIMM: TradingClosed"))).toBe("Amuma: TradingClosed");
    expect(walletErrorText(nested("The account 0x11 is not registered"))).toBe("Smart contract panicked: The account 0x11 is not registered");
  });

  it("stays quiet only for a real cancel", () => {
    expect(walletErrorText("User canceled Ethereum wallet transaction(s).")).toBeNull();
    expect(walletErrorText(Object.assign(new Error("MetaMask Tx Signature: User denied transaction signature."), { code: 4001 }))).toBeNull();
    expect(walletErrorText(new Error("User rejected the request."))).toBeNull();
    expect(walletErrorText(Object.assign(new Error("User closed the window"), { name: "MeteorActionError" }))).toBeNull();
    expect(walletErrorText(new Error("User cancelled the action"))).toBeNull();
  });

  it("passes other errors through", () => {
    expect(walletErrorText(new Error("Another wallet request is still open"))).toBe("Another wallet request is still open");
    expect(walletErrorText("Transaction execution error, failed to parse failure reason.")).toBe("Transaction execution error, failed to parse failure reason.");
    expect(walletErrorText(new Error(""))).toBe("The wallet did not send the transaction");
  });
});
