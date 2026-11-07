# @umbra-escrow-and-dispute-window/umbra-sdk

The TypeScript client and off-chain hashing engine for **Umbra**, an escrow and dispute-window protocol for machine-to-machine payments on Stellar Soroban.

It wraps the deployed Soroban escrow contract with a strictly typed method per call, an agent-facing `hire` workflow, state-polling with exponential backoff retry, browser wallet signing adapters, transaction simulation and resource footprint estimation, typed contract event decoding, and the canonical RFC 8785-inspired off-chain hashing conventions shared by the application and third-party adjudicators.

---

## Ecosystem Architecture

Umbra is structured across three repositories with a strict one-way dependency flow (**protocol → SDK → application**):

- **[umbra-contracts](https://github.com/umbra-escrow-and-dispute-window/umbra-contracts)** — The Rust Soroban escrow smart contract, protocol specification, and canonical deployment registry.
- **umbra-sdk** _(this repository)_ — The TypeScript client, event/error decoders, wallet adapters, and normative off-chain hashing implementation.
- **[umbra-app](https://github.com/umbra-escrow-and-dispute-window/umbra-app)** — The escrow explorer, dispute filing interface, and arbiter resolution console.

See [`docs/multi-repo.md`](./docs/multi-repo.md) and [`docs/architecture.md`](./docs/architecture.md) for full architectural boundaries.

---

## Compatibility

| SDK version | Protocol version | Testnet | Mainnet |
| ----------- | ---------------- | ------- | ------- |
| 0.1.x       | v0.1.0           | yes     | no      |

This table is the source of truth for compatibility and is updated in the same pull request that changes it.

## Status

Prerelease, Testnet only, unaudited. The client covers every contract call in v0.1, plus off-chain canonical hashing, event decoding, error mapping, wallet adapters, and fee estimation. Panel arbitration (`Panel`) and signed adjudicator verdicts (`Signed`) are declared in the contract types for forward compatibility and tracked for protocol v0.2 (see [`ISSUES.md`](./ISSUES.md)).

---

## Installation

```bash
pnpm add @umbra-escrow-and-dispute-window/umbra-sdk @stellar/stellar-sdk
```

---

## Quick Start (Node.js / Autonomous Agents)

The Testnet contract ID and network passphrase come from the vendored [`deployments/testnet.json`](./deployments/testnet.json), so consumers never hardcode contract addresses.

```ts
import { Keypair } from "@stellar/stellar-sdk";
import { basicNodeSigner } from "@stellar/stellar-sdk/contract";
import {
  Umbra,
  arbiter,
  verdict,
  deployments,
  State,
} from "@umbra-escrow-and-dispute-window/umbra-sdk";

const buyer = Keypair.fromSecret(process.env.STELLAR_SECRET!);

const umbra = new Umbra({
  publicKey: buyer.publicKey(),
  signTransaction: basicNodeSigner(buyer, deployments.networkPassphrase)
    .signTransaction,
  retry: { maxRetries: 3, baseDelayMs: 250 }, // Optional RPC read retry backoff
});

// 1. Create and fund an escrow in one call.
// The terms object is canonicalized and SHA-256 hashed; only the 32-byte digest goes on chain.
const { escrowId } = await umbra.hire({
  seller: "GAWPX77S5YGLCHLXNFRSKL2RQ5UG7GVQFZLMZXH7AMFP5XE46FQDYIQM",
  asset: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  amount: 500_000_000n, // stroops
  deliverBy: 9_999_999_999n,
  confirmWindow: 86_400n,
  disputeWindow: 86_400n,
  arbiter: arbiter.single(
    "GBUBKQXEC6J7O566GNLEBPBPIQCD3YV4FTL5M73WOBNBOHWSGAG2B5MA",
  ),
  terms: { work: "translate one page", price: "50" },
});

// 2. Read escrow state without requiring a signer.
const escrow = await umbra.getEscrow(escrowId);

// 3. Poll until the seller delivers (or reject with StateTimeoutError).
await umbra.waitForState(escrowId, State.Delivered, 30_000);

// 4. Confirm delivery to release funds to the seller.
await (await umbra.confirm(escrowId)).signAndSend();

// Or resolve a dispute as the designated arbiter:
await (await umbra.resolve(escrowId, verdict.refundBuyer())).signAndSend();
```

---

## Core Features & Guides

### 1. Browser Wallet Integration (Stellar Wallets Kit / Freighter)

Use `createWalletSigner` to adapt any browser extension wallet or `@creit.tech/stellar-wallets-kit` instance to `Umbra`:

```ts
import {
  Umbra,
  createWalletSigner,
} from "@umbra-escrow-and-dispute-window/umbra-sdk";

const signTransaction = createWalletSigner(
  (xdr, opts) => kit.signTransaction(xdr, opts),
  "Test SDF Network ; September 2015",
);

const client = new Umbra({
  publicKey: userAddress,
  signTransaction,
});
```

See [`docs/wallet.md`](./docs/wallet.md) for complete React/browser examples.

### 2. Transaction Simulation & Footprint Estimation

Inspect Soroban CPU instructions, RAM bytes, ledger I/O, and recommended fees before prompting a user to sign:

```ts
import { estimateTransaction } from "@umbra-escrow-and-dispute-window/umbra-sdk";

const assembled = await umbra.fund(escrowId);
const estimate = await estimateTransaction(assembled);

console.log(`Min fee: ${estimate.minFee} stroops`);
console.log(`Recommended fee (20% buffer): ${estimate.recommendedFee} stroops`);
console.log(`CPU instructions: ${estimate.footprint.cpuInstructions}`);
```

### 3. Canonical Off-Chain Document Hashing

Terms, delivery proofs, and dispute reasons remain off-chain for privacy and cost efficiency. Each document is canonicalized (sorted keys, Unicode NFC normalization, no whitespace) and hashed with a versioned domain separator:

```ts
import {
  hashTerms,
  verifyTerms,
  hashDeliveryProof,
  hashDisputeReason,
  canonicalize,
} from "@umbra-escrow-and-dispute-window/umbra-sdk";

const digest = hashTerms({ milestone: 1, deliverable: "audit report" });
const isValid = verifyTerms(
  { deliverable: "audit report", milestone: 1 },
  digest,
); // true
```

See [`docs/hashing.md`](./docs/hashing.md) for the full specification and [`test/vectors.json`](./test/vectors.json) for cross-language conformance vectors.

### 4. Typed Event Decoding

Decode raw Soroban RPC `Transition` events into strongly typed objects:

```ts
import {
  decodeTransition,
  filterEscrowEvents,
} from "@umbra-escrow-and-dispute-window/umbra-sdk";

const transitions = filterEscrowEvents(rpcEvents, escrowId);
for (const ev of transitions) {
  console.log(`Escrow ${ev.escrowId}: ${ev.kind} -> State.${ev.state}`);
}
```

### 5. Typed Error Hierarchy & Contract Error Mapping

Map Soroban host error codes (`#1` through `#11`) to descriptive error classes:

```ts
import {
  mapContractError,
  EscrowNotFoundError,
  DisputeWindowClosedError,
} from "@umbra-escrow-and-dispute-window/umbra-sdk";

try {
  await (await umbra.dispute(escrowId, reasonHash)).signAndSend();
} catch (err) {
  const mapped = mapContractError(err);
  if (mapped instanceof DisputeWindowClosedError) {
    console.error("Cannot file dispute: window has already closed.");
  }
}
```

---

## Development

Prerequisites: **Node.js 20+** and **pnpm**.

```bash
pnpm install
pnpm format:check   # Prettier formatting check
pnpm lint           # ESLint flat config
pnpm typecheck      # TypeScript strict typecheck (tsc --noEmit)
pnpm test           # Vitest unit test suite
pnpm test:coverage  # Vitest with v8 coverage report
pnpm build          # tsup ESM + .d.ts bundle into dist/
pnpm check          # Runs lint, typecheck, test, and build
```

Testnet integration tests live in [`test/integration.test.ts`](./test/integration.test.ts) and run when `STELLAR_SECRET` is configured (see [`.env.example`](./.env.example)).

## Contributing & Governance

We welcome contributions! Please read [`CONTRIBUTING.md`](./CONTRIBUTING.md) for repository guidelines, [`ISSUES.md`](./ISSUES.md) for open tasks, [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) for community standards, and [`SECURITY.md`](./SECURITY.md) for vulnerability reporting.

## License

Apache-2.0. See [`LICENSE`](./LICENSE).
