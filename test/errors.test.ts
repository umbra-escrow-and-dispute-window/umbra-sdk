import { describe, expect, it } from "vitest";
import {
  UmbraError,
  SignerRequiredError,
  StateTimeoutError,
  ContractCallError,
  State,
} from "../src/index.js";

describe("typed errors hierarchy", () => {
  it("instantiates UmbraError with default and custom codes", () => {
    const err = new UmbraError("general error");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(UmbraError);
    expect(err.name).toBe("UmbraError");
    expect(err.code).toBe("UMBRA_ERROR");
    expect(err.message).toBe("general error");

    const customErr = new UmbraError("custom msg", "CUSTOM_CODE");
    expect(customErr.code).toBe("CUSTOM_CODE");
  });

  it("instantiates SignerRequiredError with expected code and message", () => {
    const err = new SignerRequiredError();
    expect(err).toBeInstanceOf(UmbraError);
    expect(err.code).toBe("SIGNER_REQUIRED");
    expect(err.message).toContain("hire requires a signer");

    const customErr = new SignerRequiredError("custom signer required");
    expect(customErr.message).toBe("custom signer required");
  });

  it("instantiates StateTimeoutError with escrow details", () => {
    const err = new StateTimeoutError(42n, State.Funded, 5000);
    expect(err).toBeInstanceOf(UmbraError);
    expect(err.code).toBe("STATE_TIMEOUT");
    expect(err.escrowId).toBe(42n);
    expect(err.targetState).toBe(State.Funded);
    expect(err.timeoutMs).toBe(5000);
    expect(err.message).toBe("escrow 42 did not reach Funded within 5000ms");
  });

  it("instantiates ContractCallError with optional code", () => {
    const err = new ContractCallError("failed simulation", 3);
    expect(err).toBeInstanceOf(UmbraError);
    expect(err.code).toBe("CONTRACT_CALL_FAILED");
    expect(err.contractErrorCode).toBe(3);
    expect(err.message).toBe("failed simulation");
  });
});
