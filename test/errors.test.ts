import { describe, expect, it } from "vitest";
import {
  UmbraError,
  SignerRequiredError,
  StateTimeoutError,
  ContractCallError,
  EscrowNotFoundError,
  NotAuthorizedError,
  InvalidStateError,
  InvalidAmountError,
  InvalidWindowError,
  ArbiterRequiredError,
  DisputeWindowClosedError,
  ConfirmWindowOpenError,
  InvalidVerdictError,
  InvalidWindowOrderingError,
  BelowThresholdError,
  DuplicateSignerError,
  InvalidThresholdError,
  extractContractErrorCode,
  mapContractError,
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

  it("instantiates specific contract error subclasses with expected codes", () => {
    const e1 = new EscrowNotFoundError();
    expect(e1.code).toBe("ESCROW_NOT_FOUND");
    expect(e1.contractErrorCode).toBe(1);

    const e2 = new NotAuthorizedError();
    expect(e2.code).toBe("NOT_AUTHORIZED");
    expect(e2.contractErrorCode).toBe(2);

    const e3 = new InvalidStateError();
    expect(e3.code).toBe("INVALID_STATE");
    expect(e3.contractErrorCode).toBe(3);

    const e4 = new InvalidAmountError();
    expect(e4.code).toBe("INVALID_AMOUNT");
    expect(e4.contractErrorCode).toBe(4);

    const e5 = new InvalidWindowError();
    expect(e5.code).toBe("INVALID_WINDOW");
    expect(e5.contractErrorCode).toBe(5);

    const e6 = new ArbiterRequiredError();
    expect(e6.code).toBe("ARBITER_REQUIRED");
    expect(e6.contractErrorCode).toBe(6);

    const e8 = new DisputeWindowClosedError();
    expect(e8.code).toBe("DISPUTE_WINDOW_CLOSED");
    expect(e8.contractErrorCode).toBe(8);

    const e9 = new ConfirmWindowOpenError();
    expect(e9.code).toBe("CONFIRM_WINDOW_OPEN");
    expect(e9.contractErrorCode).toBe(9);

    const e10 = new InvalidVerdictError();
    expect(e10.code).toBe("INVALID_VERDICT");
    expect(e10.contractErrorCode).toBe(10);
  });
});

describe("contract error extraction and mapping", () => {
  it("extracts error codes from numbers, objects, and Soroban error messages", () => {
    expect(extractContractErrorCode(3)).toBe(3);
    expect(extractContractErrorCode({ contractErrorCode: 5 })).toBe(5);
    expect(
      extractContractErrorCode(
        "HostError: Error(Contract, #1): EscrowNotFound",
      ),
    ).toBe(1);
    expect(
      extractContractErrorCode(new Error("simulation failed ContractError(4)")),
    ).toBe(4);
    expect(extractContractErrorCode("contract returned error code #6")).toBe(6);
    expect(extractContractErrorCode("network timeout")).toBeUndefined();
    expect(extractContractErrorCode(null)).toBeUndefined();
  });

  it("maps extracted codes to matching typed error subclasses", () => {
    const err1 = mapContractError("HostError: Error(Contract, #1)");
    expect(err1).toBeInstanceOf(EscrowNotFoundError);
    expect(err1.code).toBe("ESCROW_NOT_FOUND");
    expect(err1.contractErrorCode).toBe(1);

    const err2 = mapContractError("Contract, #2");
    expect(err2).toBeInstanceOf(NotAuthorizedError);

    const err3 = mapContractError("ContractError(3)");
    expect(err3).toBeInstanceOf(InvalidStateError);

    const err4 = mapContractError("error code: 4");
    expect(err4).toBeInstanceOf(InvalidAmountError);

    const err5 = mapContractError("Contract, #5");
    expect(err5).toBeInstanceOf(InvalidWindowError);

    const err6 = mapContractError("Contract, #6");
    expect(err6).toBeInstanceOf(ArbiterRequiredError);

    const err8 = mapContractError("Contract, #8");
    expect(err8).toBeInstanceOf(DisputeWindowClosedError);

    const err9 = mapContractError("Contract, #9");
    expect(err9).toBeInstanceOf(ConfirmWindowOpenError);

    const err10 = mapContractError("Contract, #10");
    expect(err10).toBeInstanceOf(InvalidVerdictError);

    const err12 = mapContractError("Contract, #12");
    expect(err12).toBeInstanceOf(InvalidWindowOrderingError);

    const err13 = mapContractError("Contract, #13");
    expect(err13).toBeInstanceOf(BelowThresholdError);

    const err14 = mapContractError("Contract, #14");
    expect(err14).toBeInstanceOf(DuplicateSignerError);

    const err15 = mapContractError("Contract, #15");
    expect(err15).toBeInstanceOf(InvalidThresholdError);

    const unknownErr = mapContractError("network connection reset");
    expect(unknownErr).toBeInstanceOf(ContractCallError);
    expect(unknownErr.code).toBe("CONTRACT_CALL_FAILED");
    expect(unknownErr.contractErrorCode).toBeUndefined();

    // Already a ContractCallError instance is preserved
    const customCallError = new ContractCallError("custom", 99);
    expect(mapContractError(customCallError)).toBe(customCallError);
  });
});
