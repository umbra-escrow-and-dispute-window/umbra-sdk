import { describe, expect, it } from "vitest";
import {
  ValidationError,
  isValidStellarAddress,
  assertValidStellarAddress,
  assertPositiveAmount,
  assertPositiveNumber,
  assertNonEmptyString,
} from "../src/index.js";

describe("validation helpers", () => {
  const validEd25519 =
    "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
  const validContract =
    "CA3W2JO6TD3JCPTNUSNSMNROYM6NSSQID55H5BKO6GLQQKNZ5KKEIZZG";

  it("identifies valid Stellar Ed25519 and Contract addresses", () => {
    expect(isValidStellarAddress(validEd25519)).toBe(true);
    expect(isValidStellarAddress(validContract)).toBe(true);
    expect(isValidStellarAddress("not-an-address")).toBe(false);
    expect(isValidStellarAddress("")).toBe(false);
    expect(isValidStellarAddress(null)).toBe(false);
    expect(isValidStellarAddress(12345)).toBe(false);
  });

  it("assertValidStellarAddress succeeds on valid addresses and throws ValidationError on invalid", () => {
    expect(() => assertValidStellarAddress(validEd25519)).not.toThrow();
    expect(() => assertValidStellarAddress(validContract, "contractId")).not.toThrow();

    expect(() => assertValidStellarAddress("GINVALID", "seller")).toThrow(
      ValidationError,
    );
    expect(() => assertValidStellarAddress("GINVALID", "seller")).toThrow(
      "Invalid Stellar address for 'seller'",
    );
  });

  it("assertPositiveAmount validates positive bigints", () => {
    expect(() => assertPositiveAmount(100n)).not.toThrow();
    expect(() => assertPositiveAmount(1n)).not.toThrow();

    expect(() => assertPositiveAmount(0n, "amount")).toThrow(ValidationError);
    expect(() => assertPositiveAmount(-5n, "amount")).toThrow(
      "'amount' must be greater than zero",
    );
    expect(() => assertPositiveAmount(100 as unknown as bigint, "amount")).toThrow(
      "'amount' must be a bigint",
    );
  });

  it("assertPositiveNumber validates positive finite numbers", () => {
    expect(() => assertPositiveNumber(10, "disputeWindowLedgers")).not.toThrow();
    expect(() => assertPositiveNumber(0.5, "ratio")).not.toThrow();

    expect(() => assertPositiveNumber(0, "ledgers")).toThrow(ValidationError);
    expect(() => assertPositiveNumber(-1, "ledgers")).toThrow(
      "'ledgers' must be greater than zero",
    );
    expect(() => assertPositiveNumber(NaN, "ledgers")).toThrow(
      "'ledgers' must be a finite number",
    );
    expect(() => assertPositiveNumber("10", "ledgers")).toThrow(ValidationError);
  });

  it("assertNonEmptyString validates non-empty strings", () => {
    expect(() => assertNonEmptyString("ENG-1", "engagementId")).not.toThrow();

    expect(() => assertNonEmptyString("", "engagementId")).toThrow(
      ValidationError,
    );
    expect(() => assertNonEmptyString("   ", "engagementId")).toThrow(
      "'engagementId' must be a non-empty string",
    );
    expect(() => assertNonEmptyString(null, "engagementId")).toThrow(
      ValidationError,
    );
  });
});
