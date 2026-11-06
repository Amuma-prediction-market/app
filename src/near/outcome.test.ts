import { describe, expect, it } from "vitest";
import { aimmEvents, failureOf, hashOf } from "./outcome";

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
    expect(failureOf(refused)).toBe("AIMM: cost 24792066 above max_cost");
    expect(hashOf(refused)).toBe("6yPY");
  });
});
