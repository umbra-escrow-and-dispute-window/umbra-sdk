# @umbra-escrow-and-dispute-window/umbra-sdk

The TypeScript client for Umbra, an escrow and dispute-window protocol for
machine-to-machine payments on Stellar. It wraps the escrow contract with a
typed method per call, an agent-facing `hire` convenience, a `waitForState`
helper, and the canonical off-chain hashing conventions the app and any
adjudicator must share.

This is the SDK repository, the middle of three:

- [umbra-contracts](https://github.com/umbra-escrow-and-dispute-window/umbra-contracts) — the Rust escrow contract and the deployment truth.
- **umbra-sdk** (this one) — the client and the hashing conventions.
- [umbra-app](https://github.com/umbra-escrow-and-dispute-window/umbra-app) — the escrow explorer, dispute filing, and arbiter console.

Dependencies point one way: protocol, then SDK, then application. This package
depends on the contract's published bindings and deployment; it never imports app
code. See `docs/multi-repo.md`.

## Status

Prerelease, Testnet only, unaudited. The client covers every contract call in
v0.1. The collateral vault, the `UMBR` receipt asset, clawback, panel
arbitration, and the automated adjudicator are not built on chain yet, so the SDK
does not expose them; the `Panel` and `Signed` arbiter variants exist in the types
but the contract returns `Unimplemented` at resolve time.

## Compatibility

| SDK version | Protocol version | Testnet | Mainnet |
| ----------- | ---------------- | ------- | ------- |
| 0.1.x       | v0.1.0           | yes     | no      |

This table is the source of truth for compatibility and is updated in the same
pull request that changes it.

## Install

```bash
pnpm add @umbra-escrow-and-dispute-window/umbra-sdk @stellar/stellar-sdk
```

`@stellar/stellar-sdk` is a runtime dependency you install alongside the SDK.

## Use

The contract id comes from the vendored `deployments/testnet.json`, so no
consumer hardcodes it.

```ts
import { Keypair } from "@stellar/stellar-sdk";
import { basicNodeSigner } from "@stellar/stellar-sdk/contract";
import {
  Umbra,
  arbiter,
  verdict,
  deployments,
} from "@umbra-escrow-and-dispute-window/umbra-sdk";

const buyer = Keypair.fromSecret(process.env.STELLAR_SECRET!);
const umbra = new Umbra({
  publicKey: buyer.publicKey(),
  signTransaction: basicNodeSigner(buyer, deployments.networkPassphrase)
    .signTransaction,
});

// Create and fund an escrow in one call. The terms are hashed; only the hash
// goes on chain.
const { escrowId } = await umbra.hire({
  seller: "G...SELLER",
  asset: "C...ASSET", // e.g. native XLM wrapped as a Stellar Asset Contract
  amount: 500_000_000n, // stroops
  deliverBy: 9_999_999_999n,
  confirmWindow: 86_400n,
  disputeWindow: 86_400n,
  arbiter: arbiter.single("G...ARBITER"),
  terms: { work: "translate one page", price: "50" },
});

// Read state without a signer.
const escrow = await umbra.getEscrow(escrowId);

// Each call returns an AssembledTransaction; submit a state change with signAndSend.
await (await umbra.confirm(escrowId)).signAndSend();

// Or resolve a dispute as the arbiter.
await (await umbra.resolve(escrowId, verdict.refundBuyer())).signAndSend();
```

Hashing helpers (`hashTerms`, `hashDeliveryProof`, `hashDisputeReason`, and their
`verify*` counterparts) are documented in `docs/hashing.md`.

## Develop

Prerequisites: Node 20 or newer and pnpm.

```bash
pnpm install
pnpm lint        # eslint
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest; integration tests skip unless STELLAR_SECRET is set
pnpm build       # tsup, emits dist/
```

Testnet integration tests live in `test/integration.test.ts` and run only when a
funded `STELLAR_SECRET` is present; see `.env.example`. They run on a schedule in
CI, not on every pull request.

## Regenerating bindings

`src/generated/` is generated from the deployed contract and committed. The
regeneration command is in `docs/hashing.md`.

## License

Apache-2.0. See `LICENSE`.
