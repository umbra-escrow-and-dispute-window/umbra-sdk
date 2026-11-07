import { describe, expect, it } from "vitest";
import * as sdk from "../src/index.js";

describe("public entrypoint exports", () => {
  it("exports Umbra client and helper builders", () => {
    expect(typeof sdk.Umbra).toBe("function");
    expect(typeof sdk.arbiter.none).toBe("function");
    expect(typeof sdk.arbiter.single).toBe("function");
    expect(typeof sdk.verdict.refundBuyer).toBe("function");
    expect(typeof sdk.verdict.releaseSeller).toBe("function");
    expect(typeof sdk.verdict.split).toBe("function");
  });

  it("exports canonical hashing and verification functions", () => {
    expect(typeof sdk.canonicalize).toBe("function");
    expect(typeof sdk.hashTerms).toBe("function");
    expect(typeof sdk.hashDeliveryProof).toBe("function");
    expect(typeof sdk.hashDisputeReason).toBe("function");
    expect(typeof sdk.verifyTerms).toBe("function");
    expect(typeof sdk.verifyDeliveryProof).toBe("function");
    expect(typeof sdk.verifyDisputeReason).toBe("function");
    expect(sdk.DOMAIN).toBeDefined();
    expect(typeof sdk.DOMAIN.terms).toBe("string");
  });

  it("exports deployments and network configurations", () => {
    expect(sdk.deployments).toBeDefined();
    expect(sdk.rpcUrls).toBeDefined();
  });

  it("exports contract generated types and utilities", () => {
    expect(typeof sdk.EscrowClient).toBe("function");
    expect(sdk.networks).toBeDefined();
    expect(sdk.Errors).toBeDefined();
    expect(sdk.State).toBeDefined();
    expect(sdk.State.Created).toBe(0);
  });

  it("exports typed error classes and mapping helpers", () => {
    expect(typeof sdk.UmbraError).toBe("function");
    expect(typeof sdk.SignerRequiredError).toBe("function");
    expect(typeof sdk.StateTimeoutError).toBe("function");
    expect(typeof sdk.ContractCallError).toBe("function");
    expect(typeof sdk.EscrowNotFoundError).toBe("function");
    expect(typeof sdk.NotAuthorizedError).toBe("function");
    expect(typeof sdk.InvalidStateError).toBe("function");
    expect(typeof sdk.InvalidAmountError).toBe("function");
    expect(typeof sdk.InvalidWindowError).toBe("function");
    expect(typeof sdk.ArbiterRequiredError).toBe("function");
    expect(typeof sdk.DisputeWindowClosedError).toBe("function");
    expect(typeof sdk.ConfirmWindowOpenError).toBe("function");
    expect(typeof sdk.InvalidVerdictError).toBe("function");
    expect(typeof sdk.extractContractErrorCode).toBe("function");
    expect(typeof sdk.mapContractError).toBe("function");
  });

  it("exports retry, event decoder, wallet adapter, and simulation estimation", () => {
    expect(typeof sdk.withRetry).toBe("function");
    expect(typeof sdk.decodeTransition).toBe("function");
    expect(typeof sdk.filterEscrowEvents).toBe("function");
    expect(typeof sdk.createWalletSigner).toBe("function");
    expect(typeof sdk.estimateTransaction).toBe("function");
  });
});
