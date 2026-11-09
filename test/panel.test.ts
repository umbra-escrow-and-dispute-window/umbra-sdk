import { describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { arbiter, verdict, Umbra, ValidationError } from "../src/index.js";

const kp1 = Keypair.random();
const kp2 = Keypair.random();
const kp3 = Keypair.random();

const ADDR_1 = kp1.publicKey();
const ADDR_2 = kp2.publicKey();
const ADDR_3 = kp3.publicKey();

describe("Panel arbitration helper", () => {
  it("constructs valid panel arbiter config", () => {
    const config = arbiter.panel([ADDR_1, ADDR_2, ADDR_3], 2);
    expect(config.tag).toBe("Panel");
    expect(config.values).toEqual([[ADDR_1, ADDR_2, ADDR_3], 2]);
  });

  it("rejects empty panel members", () => {
    expect(() => arbiter.panel([], 1)).toThrowError(ValidationError);
  });

  it("rejects duplicate panel members", () => {
    expect(() => arbiter.panel([ADDR_1, ADDR_1], 1)).toThrowError(
      ValidationError,
    );
  });

  it("rejects invalid member Stellar addresses", () => {
    expect(() => arbiter.panel(["not-an-address"], 1)).toThrowError(
      ValidationError,
    );
  });

  it("rejects threshold of zero or exceeding members count", () => {
    expect(() => arbiter.panel([ADDR_1, ADDR_2], 0)).toThrowError(
      ValidationError,
    );
    expect(() => arbiter.panel([ADDR_1, ADDR_2], 3)).toThrowError(
      ValidationError,
    );
  });

  it("validates signers in resolvePanel", () => {
    const umbra = new Umbra();

    expect(() =>
      umbra.resolvePanel(1n, verdict.refundBuyer(), []),
    ).toThrowError(ValidationError);

    expect(() =>
      umbra.resolvePanel(1n, verdict.refundBuyer(), [ADDR_1, ADDR_1]),
    ).toThrowError(ValidationError);

    expect(() =>
      umbra.resolvePanel(1n, verdict.refundBuyer(), ["bad-address"]),
    ).toThrowError(ValidationError);
  });
});
