import { describe, expect, it } from "vitest";
import { Umbra, arbiter, verdict, deployments, State } from "../src/index.js";

describe("Umbra construction", () => {
  it("defaults the contract id to the vendored deployment", () => {
    const u = new Umbra();
    expect(u.contractId).toBe(deployments.contracts.escrow);
    expect(u.networkPassphrase).toBe(deployments.networkPassphrase);
  });

  it("accepts an explicit contract id override", () => {
    const id = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
    const u = new Umbra({ contractId: id });
    expect(u.contractId).toBe(id);
  });

  it("accepts custom rpcUrl with HTTP and HTTPS", () => {
    const httpsUmbra = new Umbra({ rpcUrl: "https://custom-rpc.stellar.org" });
    expect(httpsUmbra.client.options.rpcUrl).toBe(
      "https://custom-rpc.stellar.org",
    );
    expect(httpsUmbra.client.options.allowHttp).toBe(false);

    const httpUmbra = new Umbra({ rpcUrl: "http://localhost:8000" });
    expect(httpUmbra.client.options.rpcUrl).toBe("http://localhost:8000");
    expect(httpUmbra.client.options.allowHttp).toBe(true);
  });

  it("passes publicKey and signTransaction to the client", () => {
    const mockSigner = async (xdr: string) => ({ signedTxXdr: xdr });
    const u = new Umbra({
      publicKey: "GBUYER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      signTransaction: mockSigner,
    });
    expect(u.client.options.publicKey).toBe(
      "GBUYER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    );
    expect(u.client.options.signTransaction).toBe(mockSigner);
  });

  it("hire refuses to run without a signer", async () => {
    const u = new Umbra();
    await expect(
      u.hire({
        seller: "GAWPX77S5YGLCHLXNFRSKL2RQ5UG7GVQFZLMZXH7AMFP5XE46FQDYIQM",
        asset: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        amount: 1000n,
        deliverBy: 9999999999n,
        confirmWindow: 86400n,
        disputeWindow: 86400n,
        arbiter: arbiter.none(),
        terms: { work: "x" },
      }),
    ).rejects.toThrow(/signer/);
  });
});

describe("enum helpers", () => {
  it("builds arbiter variants", () => {
    expect(arbiter.none()).toEqual({ tag: "None", values: undefined });
    expect(arbiter.single("G...")).toEqual({ tag: "Single", values: ["G..."] });
  });

  it("builds verdict variants", () => {
    expect(verdict.refundBuyer().tag).toBe("RefundBuyer");
    expect(verdict.releaseSeller().tag).toBe("ReleaseSeller");
    expect(verdict.split(4000)).toEqual({ tag: "Split", values: [4000] });
  });

  it("re-exports the on-chain State enum", () => {
    expect(State.ResolvedBuyer).toBe(6);
  });
});
