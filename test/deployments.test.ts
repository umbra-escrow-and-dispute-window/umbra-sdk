import { describe, expect, it } from "vitest";
import { deployments, rpcUrls } from "../src/index.js";

describe("deployments export", () => {
  it("exports valid testnet deployment structure", () => {
    expect(deployments.network).toBe("testnet");
    expect(deployments.networkPassphrase).toBe(
      "Test SDF Network ; September 2015",
    );
    expect(typeof deployments.deployedAt).toBe("string");
    expect(typeof deployments.commit).toBe("string");
    expect(typeof deployments.contracts.escrow).toBe("string");
    expect(deployments.contracts.escrow.startsWith("C")).toBe(true);
  });

  it("exports valid rpc url mappings", () => {
    expect(rpcUrls.testnet).toBe("https://soroban-testnet.stellar.org");
  });
});
