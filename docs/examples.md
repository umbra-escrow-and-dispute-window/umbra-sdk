# End-to-End Escrow Lifecycle & Arbitration Examples

This guide walks through the three core escrow lifecycles supported by `@umbra-escrow-and-dispute-window/umbra-sdk` on Stellar Soroban:

1. **Happy Path**: Buyer hires and funds → Seller delivers → Buyer confirms release.
2. **Timeout Claim**: Buyer hires and funds → Seller delivers → Confirm window expires → Seller claims timeout release.
3. **Disputed Escrow & Split Resolution**: Buyer hires and funds → Seller delivers → Buyer files dispute → Arbiter resolves with a split verdict.

---

## 1. Happy Path: Hire, Deliver, and Confirm

```ts
import { Keypair } from "@stellar/stellar-sdk";
import { basicNodeSigner } from "@stellar/stellar-sdk/contract";
import {
  Umbra,
  arbiter,
  deployments,
  hashDeliveryProof,
  verifyDeliveryProof,
  State,
} from "@umbra-escrow-and-dispute-window/umbra-sdk";

const buyerKp = Keypair.fromSecret(process.env.STELLAR_SECRET!);
const sellerKp = Keypair.fromSecret(process.env.STELLAR_SELLER_SECRET!);

const buyerClient = new Umbra({
  publicKey: buyerKp.publicKey(),
  signTransaction: basicNodeSigner(buyerKp, deployments.networkPassphrase)
    .signTransaction,
});

const sellerClient = new Umbra({
  publicKey: sellerKp.publicKey(),
  signTransaction: basicNodeSigner(sellerKp, deployments.networkPassphrase)
    .signTransaction,
});

// Step 1: Buyer creates and funds the escrow in one call
const { escrowId } = await buyerClient.hire({
  seller: sellerKp.publicKey(),
  asset: process.env.STELLAR_ASSET!,
  amount: 250_000_000n, // 25 XLM / tokens (7 decimals)
  deliverBy: BigInt(Math.floor(Date.now() / 1000) + 86_400),
  confirmWindow: 3_600n,
  disputeWindow: 7_200n,
  arbiter: arbiter.none(),
  terms: {
    task: "Dataset labeling batch #42",
    format: "jsonl",
    minAccuracy: 0.98,
  },
});

// Step 2: Seller delivers work and records canonical delivery proof hash on-chain
const proofDocument = {
  artifactUri:
    "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
  rowCount: 10000,
  completedAt: "2026-11-07T10:00:00Z",
};
const proofHash = hashDeliveryProof(proofDocument);

await (await sellerClient.markDelivered(escrowId, proofHash)).signAndSend();

// Step 3: Buyer verifies off-chain proof against on-chain digest and confirms
const onChainEscrow = await buyerClient.waitForState(escrowId, State.Delivered);
if (
  onChainEscrow.delivery_proof_hash &&
  verifyDeliveryProof(proofDocument, onChainEscrow.delivery_proof_hash)
) {
  await (await buyerClient.confirm(escrowId)).signAndSend();
}
```

---

## 2. Timeout Claim (Seller Auto-Release After Confirm Window)

If the buyer does not confirm or open a dispute before `confirmWindow` elapses after delivery, the seller can claim the escrowed funds directly:

```ts
import {
  mapContractError,
  ConfirmWindowOpenError,
} from "@umbra-escrow-and-dispute-window/umbra-sdk";

try {
  const claimTx = await sellerClient.claimTimeout(escrowId);
  await claimTx.signAndSend();
} catch (err) {
  const mapped = mapContractError(err);
  if (mapped instanceof ConfirmWindowOpenError) {
    console.log(
      "Confirmation window is still open; retry after window expiry.",
    );
  } else {
    throw mapped;
  }
}
```

---

## 3. Dispute Filing and Arbiter Resolution

When an escrow is configured with `arbiter.single(arbiterPublicKey)`, the buyer can dispute within `disputeWindow` and the arbiter can issue a `RefundBuyer`, `ReleaseSeller`, or proportional `Split(buyerBps)` verdict:

```ts
import {
  verdict,
  hashDisputeReason,
  State,
} from "@umbra-escrow-and-dispute-window/umbra-sdk";

// Buyer files dispute with canonical reason hash
const reasonHash = hashDisputeReason({
  issue: "Incomplete dataset",
  missingRows: 2400,
});
await (
  await buyerClient.dispute(escrowId, buyerKp.publicKey(), reasonHash)
).signAndSend();

await buyerClient.waitForState(escrowId, State.Disputed);

// Arbiter reviews off-chain evidence and resolves with a 60% buyer / 40% seller split (6000 bps)
const resolveTx = await arbiterClient.resolve(escrowId, verdict.split(6000));
await resolveTx.signAndSend();
```
