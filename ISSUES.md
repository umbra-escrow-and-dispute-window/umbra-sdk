# Issues and Roadmap

The milestones for this repository across the v0.1 release and the upcoming v0.2 protocol cycle, ordered easiest to hardest, with acceptance criteria and difficulty labels (`good first issue`, `intermediate`, `advanced`).

---

## Completed in v0.1

### 1. Retry and backoff for RPC reads — `[COMPLETED]`

Label: good first issue | Implemented in `src/retry.ts`, `src/umbra.ts`, `test/retry.test.ts`

`getEscrow` and `waitForState` issue plain RPC calls. Testnet rate-limits and
occasionally returns a stale read, which `waitForState` already tolerates by
polling, but a single `getEscrow` does not.

Acceptance: a small retry-with-backoff wrapper around read calls, configurable
and off by default for a single call; unit tests with a mocked transport; no new
runtime dependency.

### 2. Typed event decoding — `[COMPLETED]`

Label: good first issue | Implemented in `src/events.ts`, `test/events.test.ts`

The contract emits one `Transition` event per state change with topics
`("umbra", kind, escrow_id)`. The SDK has no helper to decode them.

Acceptance: a `decodeTransition(event)` that returns `{ kind, escrowId, state }`
typed against the `State` enum, plus a helper to filter a page of RPC events for
one escrow; unit tests over captured event XDR.

### 3. Hashing conformance vectors shared with the contract — `[COMPLETED]`

Label: intermediate | Implemented in `test/vectors.json`, `test/hashing.test.ts`

`docs/hashing.md` defines canonicalisation, but there is no fixture set both this
repository and a future on-chain verifier can test against.

Acceptance: a committed `test/vectors.json` of documents and their expected
hashes, exercised here and referenced from the contract repository, covering key
order, unicode NFC, nested structures, and the string-amount convention.

### 4. Browser wallet signer adapter — `[COMPLETED]`

Label: intermediate | Implemented in `src/wallet.ts`, `test/wallet.test.ts`, `docs/wallet.md`

`hire` and the send helpers take a `signTransaction` in the Stellar SDK's shape.
Node scripts use `basicNodeSigner`; the app uses Stellar Wallets Kit. A thin
adapter would remove per-app glue.

Acceptance: an adapter that turns a Stellar Wallets Kit signer into the SDK's
`SignTransaction`, documented with an example; no direct dependency on any single
wallet library.

### 5. Fee and resource estimation helpers — `[COMPLETED]`

Label: intermediate | Implemented in `src/simulation.ts`, `test/simulation.test.ts`, `docs/wallet.md`

Callers currently rely on the default simulation. A helper to surface the
estimated fee and resource usage before sending would make agent automation
predictable.

Acceptance: a helper returning the estimated fee and footprint from an
`AssembledTransaction` before `signAndSend`, with a unit test over a simulated
transaction.

---

## Completed in v0.2 Protocol Cycle

### 6. Publish to a public registry with provenance — `[COMPLETED]`

Label: intermediate | Implemented in `.github/workflows/publish.yml`, `package.json`

Documented and automated package publishing pipeline with npm build provenance (`--provenance`) and dry-run validation.

### 7. Panel arbitration client support — `[COMPLETED]`

Label: advanced | Implemented in `src/umbra.ts`, `test/panel.test.ts`

Implemented `arbiter.panel(members, threshold)` constructor with member deduplication and threshold sanity checks, plus `resolvePanel` with signer verification.

### 8. Signed adjudicator verdicts — `[COMPLETED]`

Label: advanced | Implemented in `src/adjudicator.ts`, `src/umbra.ts`, `test/adjudicator.test.ts`

Implemented `buildSignedVerdictPayload` adhering to the canonical 32-byte payload format `umbra:adjudicate:v1`, `signVerdictPayload`, `verifyVerdictSignature`, and `resolveSigned`.
