import { describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { basicNodeSigner } from "@stellar/stellar-sdk/contract";
import { Umbra, arbiter, verdict, deployments, State } from "../src/index.js";
import { hashDeliveryProof, hashDisputeReason } from "../src/index.js";

// These hit Testnet and are skipped unless a funded key is present. They run on
// a schedule in CI, not on every pull request, because Testnet resets and rate
// limits make them flaky as a gate. Run locally with:
//   STELLAR_SECRET=S... STELLAR_SELLER=G... STELLAR_ASSET=C... pnpm test
const secret = process.env.STELLAR_SECRET;

describe.skipIf(!secret)("Testnet dispute cycle", () => {
  it("hires, delivers, disputes, and resolves as a refund", async () => {
    const buyer = Keypair.fromSecret(secret!);
    const arbiterKp = Keypair.fromSecret(process.env.STELLAR_ARBITER ?? secret!);
    const seller = process.env.STELLAR_SELLER!;
    const asset = process.env.STELLAR_ASSET!;

    const buyerUmbra = new Umbra({
      publicKey: buyer.publicKey(),
      signTransaction: basicNodeSigner(buyer, deployments.networkPassphrase)
        .signTransaction,
    });

    const { escrowId } = await buyerUmbra.hire({
      seller,
      asset,
      amount: 500_000_000n,
      deliverBy: 9_999_999_999n,
      confirmWindow: 86_400n,
      disputeWindow: 86_400n,
      arbiter: arbiter.single(arbiterKp.publicKey()),
      terms: { work: "integration test", price: "50" },
    });

    // Seller marks delivery.
    const sellerKp = Keypair.fromSecret(process.env.STELLAR_SELLER_SECRET!);
    const sellerUmbra = new Umbra({
      publicKey: sellerKp.publicKey(),
      signTransaction: basicNodeSigner(sellerKp, deployments.networkPassphrase)
        .signTransaction,
    });
    await (
      await sellerUmbra.markDelivered(escrowId, hashDeliveryProof({ url: "x" }))
    ).signAndSend();

    // Buyer disputes.
    await (
      await buyerUmbra.dispute(escrowId, hashDisputeReason({ why: "wrong" }))
    ).signAndSend();

    // Arbiter refunds.
    const arbiterUmbra = new Umbra({
      publicKey: arbiterKp.publicKey(),
      signTransaction: basicNodeSigner(arbiterKp, deployments.networkPassphrase)
        .signTransaction,
    });
    await (
      await arbiterUmbra.resolve(escrowId, verdict.refundBuyer())
    ).signAndSend();

    const escrow = await buyerUmbra.getEscrow(escrowId);
    expect(escrow?.state).toBe(State.ResolvedBuyer);
  }, 120_000);
});
