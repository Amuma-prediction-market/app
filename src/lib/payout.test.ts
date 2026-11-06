import { describe, expect, it } from "vitest";
import { payoutAfterBuy, payoutRate, winningSupply } from "./payout";
import { WAD } from "./units";
import type { Question } from "../near/aimm";

const q = {
  answers: ["a", "b", "c"],
  pot: 1_000n,
  yesSupply: [900n, 100n, 0n],
  noSupply: [0n, 0n, 50n],
} as unknown as Question;

describe("payout", () => {
  it("counts YES on the answer and NO on the others", () => {
    expect(winningSupply(q, 0)).toBe(950n);
    expect(winningSupply(q, 2)).toBe(0n);
  });

  it("pays in full while the pot covers the winners", () => {
    expect(payoutRate(1_000n, 950n)).toBe(WAD);
    expect(payoutRate(1_000n, 0n)).toBe(WAD);
    expect(payoutRate(1_000n, 2_000n)).toBe(WAD / 2n);
  });

  it("shares the pot once a buy owes more than it holds", () => {
    // 950 + 150 = 1,100 winning tokens against 1,000 + 60 in the pot
    expect(payoutAfterBuy(q, 0, true, 150n, 60n)).toBe((1_060n * WAD) / 1_100n);
    // a NO on c pays if a or b wins; a is the tighter one
    expect(payoutAfterBuy(q, 2, false, 150n, 60n)).toBe((1_060n * WAD) / 1_100n);
  });
});
