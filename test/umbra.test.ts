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

describe("Umbra contract call delegations", () => {
  const dummyEscrow = {
    id: 42n,
    buyer: "GBUYER",
    seller: "GSELLER",
    asset: "CASSET",
    amount: 1000n,
    deliver_by: 99999n,
    confirm_window: 86400n,
    dispute_window: 86400n,
    created_at: 1000n,
    delivered_at: 0n,
    arbiter: arbiter.none(),
    state: State.Created,
    terms_hash: Buffer.alloc(32),
    proof_hash: Buffer.alloc(32),
    reason_hash: Buffer.alloc(32),
  };

  it("reads an existing escrow or undefined if not found", async () => {
    const u = new Umbra();
    u.client.get_escrow = (async ({ escrow_id }: { escrow_id: bigint }) => ({
      result: escrow_id === 42n ? dummyEscrow : null,
    })) as unknown as typeof u.client.get_escrow;

    const found = await u.getEscrow(42n);
    expect(found).toEqual(dummyEscrow);

    const missing = await u.getEscrow(99n);
    expect(missing).toBeUndefined();
  });

  it("delegates fund, markDelivered, confirm, claimTimeout, dispute, resolve, and cancel", async () => {
    const u = new Umbra();
    let called: string | null = null;
    let receivedArgs: unknown = null;

    u.client.fund = (async (args: unknown) => {
      called = "fund";
      receivedArgs = args;
      return { result: undefined };
    }) as unknown as typeof u.client.fund;
    await u.fund(10n);
    expect(called).toBe("fund");
    expect(receivedArgs).toEqual({ escrow_id: 10n });

    u.client.mark_delivered = (async (args: unknown) => {
      called = "mark_delivered";
      receivedArgs = args;
      return { result: undefined };
    }) as unknown as typeof u.client.mark_delivered;
    const proof = Buffer.alloc(32, 1);
    await u.markDelivered(10n, proof);
    expect(called).toBe("mark_delivered");
    expect(receivedArgs).toEqual({ escrow_id: 10n, proof_hash: proof });

    u.client.confirm = (async (args: unknown) => {
      called = "confirm";
      receivedArgs = args;
      return { result: undefined };
    }) as unknown as typeof u.client.confirm;
    await u.confirm(10n);
    expect(called).toBe("confirm");
    expect(receivedArgs).toEqual({ escrow_id: 10n });

    u.client.claim_timeout = (async (args: unknown) => {
      called = "claim_timeout";
      receivedArgs = args;
      return { result: undefined };
    }) as unknown as typeof u.client.claim_timeout;
    await u.claimTimeout(10n);
    expect(called).toBe("claim_timeout");
    expect(receivedArgs).toEqual({ escrow_id: 10n });

    u.client.dispute = (async (args: unknown) => {
      called = "dispute";
      receivedArgs = args;
      return { result: undefined };
    }) as unknown as typeof u.client.dispute;
    const reason = Buffer.alloc(32, 2);
    await u.dispute(10n, reason);
    expect(called).toBe("dispute");
    expect(receivedArgs).toEqual({ escrow_id: 10n, reason_hash: reason });

    u.client.resolve = (async (args: unknown) => {
      called = "resolve";
      receivedArgs = args;
      return { result: undefined };
    }) as unknown as typeof u.client.resolve;
    const verd = verdict.releaseSeller();
    const sig = Buffer.alloc(64, 3);
    await u.resolve(10n, verd, sig);
    expect(called).toBe("resolve");
    expect(receivedArgs).toEqual({
      escrow_id: 10n,
      verdict: verd,
      signature: sig,
    });

    // resolve without signature
    await u.resolve(10n, verd);
    expect(receivedArgs).toEqual({
      escrow_id: 10n,
      verdict: verd,
      signature: undefined,
    });

    u.client.cancel = (async (args: unknown) => {
      called = "cancel";
      receivedArgs = args;
      return { result: undefined };
    }) as unknown as typeof u.client.cancel;
    await u.cancel(10n, "GBUYER");
    expect(called).toBe("cancel");
    expect(receivedArgs).toEqual({ escrow_id: 10n, caller: "GBUYER" });
  });

  it("waitForState resolves when target state matches", async () => {
    const u = new Umbra();
    let polls = 0;
    u.client.get_escrow = (async () => {
      polls++;
      return {
        result: {
          ...dummyEscrow,
          state: polls >= 2 ? State.Funded : State.Created,
        },
      };
    }) as unknown as typeof u.client.get_escrow;

    const res = await u.waitForState(42n, State.Funded, 1000, 10);
    expect(res.state).toBe(State.Funded);
    expect(polls).toBe(2);
  });

  it("waitForState times out if target state is not reached", async () => {
    const u = new Umbra();
    u.client.get_escrow = (async () => ({
      result: { ...dummyEscrow, state: State.Created },
    })) as unknown as typeof u.client.get_escrow;

    await expect(u.waitForState(42n, State.Released, 50, 10)).rejects.toThrow(
      /did not reach Released within 50ms/,
    );
  });

  it("hire creates and funds an escrow end-to-end", async () => {
    const mockSigner = async (xdr: string) => ({ signedTxXdr: xdr });
    const u = new Umbra({
      publicKey: "GBUYER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      signTransaction: mockSigner,
    });

    let createdCalled = false;
    let fundCalled = false;

    u.client.create_escrow = (async () => {
      createdCalled = true;
      return {
        signAndSend: async () => ({
          result: {
            unwrap: () => 101n,
          },
        }),
      };
    }) as unknown as typeof u.client.create_escrow;

    u.client.fund = (async () => {
      fundCalled = true;
      return {
        signAndSend: async () => ({
          result: {
            unwrap: () => undefined,
          },
        }),
      };
    }) as unknown as typeof u.client.fund;

    const res = await u.hire({
      seller: "GSELLER",
      asset: "CASSET",
      amount: 5000n,
      deliverBy: 123456n,
      confirmWindow: 3600n,
      disputeWindow: 3600n,
      arbiter: arbiter.single("GARBITER"),
      terms: { task: "code review" },
    });

    expect(res).toEqual({ escrowId: 101n });
    expect(createdCalled).toBe(true);
    expect(fundCalled).toBe(true);
  });
});
