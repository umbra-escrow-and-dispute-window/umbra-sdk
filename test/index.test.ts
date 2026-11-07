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

  it("exports typed error classes", () => {
    expect(typeof sdk.UmbraError).toBe("function");
    expect(typeof sdk.SignerRequiredError).toBe("function");
    expect(typeof sdk.StateTimeoutError).toBe("function");
    expect(typeof sdk.ContractCallError).toBe("function");
  });
});
