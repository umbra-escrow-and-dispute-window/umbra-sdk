# Changelog

All notable changes to `@umbra-escrow-and-dispute-window/umbra-sdk` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-11-09

### Added

- **Panel Arbitration Client Support (Issue 7)**: Added `arbiter.panel(members, threshold)` constructor with member deduplication and threshold bounds checking, plus `resolvePanel` with signer validation.
- **Signed Adjudicator Verdicts (Issue 8)**: Added `buildSignedVerdictPayload` constructing the canonical 32-byte payload format `umbra:adjudicate:v1 || escrow_id || verdict_tag || buyer_bps`, `signVerdictPayload` using Ed25519 keys, `verifyVerdictSignature`, and `resolveSigned`.
- **Typed Error Expansion**: Added `InvalidWindowOrderingError` (code 12), `BelowThresholdError` (code 13), `DuplicateSignerError` (code 14), and `InvalidThresholdError` (code 15).
- **Dispute Bond Support**: Added optional `disputeBond` configuration to `HireParams` and pre-flight validation.
- **Astrolabe Reputation Attestations**: Added `decodeAttestationRecord` helper to parse `["astrolabe", "record", escrowId]` topic and outcome data.
- **Storage TTL Maintenance**: Added `extendEscrowTtl` to renew active escrow storage leases.
- **Collateral Vault Client (`src/vault.ts`)**: Added `UmbraVault` client supporting seller deposits, withdrawals, liability locks, and dispute slashing.
- **Provenance Release Pipeline (Issue 6)**: Added `.github/workflows/publish.yml` with npm build provenance.

## [0.1.0-rc.1] - 2026-11-07

### Added

- **Umbra Client (`src/umbra.ts`)**: Typed wrapper around the Soroban escrow contract with one method per contract call (`fund`, `markDelivered`, `confirm`, `claimTimeout`, `dispute`, `resolve`, `cancel`, `getEscrow`), an agent-facing `hire` flow (`create_escrow` + `fund`), and `waitForState` polling.
- **Canonical Document Hashing (`src/hashing.ts`)**: Deterministic RFC 8785-subset JSON canonicalization (sorted keys, Unicode NFC normalization, finite number validation) and domain-separated SHA-256 helpers (`hashTerms`, `hashDeliveryProof`, `hashDisputeReason`, and `verify*` counterparts).
- **Cross-Protocol Conformance Vectors (`test/vectors.json`)**: Canonical JSON and SHA-256 test vectors shared across the Umbra protocol repositories.
- **RPC Retry with Exponential Backoff (`src/retry.ts`)**: Zero-dependency `withRetry` helper supporting configurable `maxRetries`, `baseDelayMs`, `maxDelayMs`, and custom `shouldRetry` predicates, integrated into `Umbra.getEscrow`.
- **Typed Soroban Event Decoding (`src/events.ts`)**: `decodeTransition` and `filterEscrowEvents` helpers to parse raw `ScVal` or base64 XDR contract events into typed `{ kind, escrowId, state }` transition objects.
- **Browser Wallet Signer Adapter (`src/wallet.ts`)**: `createWalletSigner` adapter bridging Stellar Wallets Kit and Freighter signers to the SDK's `SignTransaction` callback.
- **Transaction Simulation & Footprint Estimation (`src/simulation.ts`)**: `estimateTransaction` utility returning CPU instructions, RAM bytes, ledger read/write bytes, minimum network fee, and buffered recommended fee.
- **Typed Error Hierarchy & Contract Error Mapping (`src/errors.ts`)**: `UmbraError`, `SignerRequiredError`, `StateTimeoutError`, `ContractCallError`, and specific classes for Soroban contract error codes `#1`–`#10` (`EscrowNotFoundError`, `NotAuthorizedError`, `InvalidStateError`, `InvalidAmountError`, `InvalidWindowError`, `ArbiterRequiredError`, `DisputeWindowClosedError`, `ConfirmWindowOpenError`, `InvalidVerdictError`) with `extractContractErrorCode` and `mapContractError`.
- **Pre-Flight Parameter Validation (`src/validation.ts`)**: `ValidationError`, `isValidStellarAddress`, `assertValidStellarAddress`, `assertPositiveAmount`, `assertPositiveNumber`, and `assertNonEmptyString` guards enforced before submitting transactions.
- **Documentation & Governance**: Added `docs/architecture.md`, `docs/wallet.md`, `CODE_OF_CONDUCT.md`, GitHub issue/PR templates, and multi-Node CI and scheduled Testnet integration workflows.

### Fixed

- Replaced untyped `AssembledTransaction<any>` return signatures with strictly typed `AssembledTransaction<Result<void>>` and enabled `@typescript-eslint/no-explicit-any`.
- Patched transitive dependency advisories in `axios`, `follow-redirects`, and `smol-toml` via workspace overrides.
