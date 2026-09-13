# Contributing to umbra-sdk

Thanks for helping build Umbra. This file gets a contributor who has never
touched Stellar from a clone to an open pull request in a day.

## What this repository is, and the other two

Umbra is an escrow and dispute-window protocol for machine-to-machine payments on
Stellar. A buyer funds an escrow, a seller delivers, and the buyer confirms, lets
it auto-release after a timeout, or disputes within a window. An arbiter chosen by
both parties resolves a dispute.

Umbra is three repositories:

- [umbra-contracts](https://github.com/umbra-escrow-and-dispute-window/umbra-contracts) — the Rust escrow contract, its specification, and the Testnet deployment.
- **umbra-sdk** (this one) — the TypeScript client and the off-chain hashing conventions.
- [umbra-app](https://github.com/umbra-escrow-and-dispute-window/umbra-app) — the escrow explorer, dispute filing, and arbiter console.

Dependencies point one way: **protocol, then SDK, then application, never
reversed.** This package depends on the contract's published bindings and
deployment; it never imports app code, and if the app needs something the SDK
cannot do, the fix goes here, not in the app. `docs/multi-repo.md` is the full
cross-repository contract.

## The domain in two minutes

- **Escrow.** The contract holds the buyer's funds between funding and a terminal
  outcome. The SDK is a typed front door to its calls.
- **Windows.** After delivery, a confirm window (after which the seller can claim)
  and a dispute window (inside which the buyer can dispute) both start from the
  same ledger timestamp.
- **Hashes, not documents.** Terms, delivery proofs, and dispute reasons live off
  chain; only their 32-byte hashes go on chain. The SDK owns the one canonical way
  to compute them, so the app and any adjudicator agree.
- **The client signs nothing itself.** It takes a `signTransaction` callback; keys
  never enter the SDK.

The contract's own normative document is `docs/protocol.md` in the contract
repository. The SDK's normative document is `docs/hashing.md`; the app must not
re-implement what it specifies.

## Repository map

```
src/
  index.ts        Public surface: what consumers import
  umbra.ts        The Umbra class, hire(), waitForState(), one method per call
  hashing.ts      Canonical JSON and the document hash functions
  deployments.ts  Loads and exports the vendored deployment
  generated/      GENERATED from the deployed contract; do not edit by hand
deployments/
  testnet.json    Vendored from the contract repository's release
docs/
  hashing.md      Normative hashing conventions
  multi-repo.md   Cross-repository contract, shared across all three repos
test/
  hashing.test.ts      Canonicalisation and hashing, including edge cases
  umbra.test.ts        Client construction and enum helpers, no network
  integration.test.ts  Testnet cycle, skipped unless STELLAR_SECRET is set
```

Regenerate `src/generated/` with the command in `docs/hashing.md`. Never edit it
by hand; a change there that is not in the contract will be lost on the next
regeneration.

## Getting set up

Prerequisites: Node 20 or newer, and pnpm (`corepack enable pnpm`, or
`npm i -g pnpm`).

```bash
git clone https://github.com/umbra-escrow-and-dispute-window/umbra-sdk
cd umbra-sdk
pnpm install

pnpm test        # unit tests only; no network, no key needed
```

That is the proof your setup works. The unit tests need nothing external.

To run the Testnet integration test you need funded keys. A Testnet key is free
and funded by Friendbot via the stellar CLI:

```bash
stellar keys generate umbra-buyer --network testnet --fund
```

Copy `.env.example` to `.env`, fill in the secrets, and the integration test in
`test/integration.test.ts` will run instead of skipping. It hits Testnet, so it is
not part of the pull-request gate.

## Where to start

Issues carry `good first issue`, `intermediate`, or `advanced`. The full list with
acceptance criteria is `ISSUES.md`; this is the same list, easiest first.

1. **Retry and backoff for RPC reads** (`good first issue`). Make a single read as
   resilient as the polling helper already is.
2. **Typed event decoding** (`good first issue`). Decode the contract's
   `Transition` events into typed objects.
3. **Hashing conformance vectors** (`intermediate`). A fixture set shared with the
   contract so both sides hash identically. See `docs/hashing.md`.
4. **Browser wallet signer adapter** (`intermediate`). Adapt Stellar Wallets Kit
   to the SDK's `signTransaction` shape.
5. **Fee and resource estimation helpers** (`intermediate`). Surface the estimated
   fee before sending.
6. **Publish to a public registry with provenance** (`intermediate`). The path off
   GitHub-release tarballs to a real registry.
7. **Panel arbitration client support** (`advanced`). Follows contracts issue 7.
8. **Signed adjudicator verdicts** (`advanced`). Follows contracts issue 8; the
   canonical verdict payload must match the contract byte for byte. This, together
   with the panel work, is the largest unclaimed area, and it is blocked on the
   contract implementing the matching variants.

Claim an issue by commenting on it. Open a Discussion first for anything that
changes the public API surface or the hashing scheme, since both ripple into the
app.

## Rules that matter here

A reviewer will send a pull request back for any of these:

- **The client never touches keys.** Signing is a caller-supplied callback. Do not
  add code that reads, stores, logs, or forwards a secret key.
- **No hardcoded contract ids.** Ids come from `deployments/testnet.json`, vendored
  from the contract repository. A feature pull request does not edit that file.
- **Never break the hashing scheme quietly.** Canonicalisation, the domain
  separators, and NFC normalisation are a contract with the app and every
  adjudicator. Any change bumps the domain version and updates `docs/hashing.md`
  and the tests together.
- **Do not hand-edit `src/generated/`.** Regenerate it from the contract.
- **The compatibility table in the README is updated in the same pull request**
  that changes protocol compatibility.

## Code style

TypeScript, ESM. Formatter and linter is ESLint (flat config). Type-checked with
`tsc`. Tests with Vitest. Commits follow
[Conventional Commits](https://www.conventionalcommits.org). Branch names are
`type/short-description`, for example `feat/event-decoding`.

CI runs exactly these, and they must pass:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Pull request checklist

- [ ] `pnpm lint` clean
- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` green
- [ ] `pnpm build` succeeds
- [ ] No secret keys read, logged, or stored anywhere
- [ ] `src/generated/` not hand-edited
- [ ] `docs/hashing.md` and tests updated together if the hashing scheme changed
- [ ] README compatibility table updated if protocol compatibility changed
- [ ] If this change spans repositories, the dependent pull request is linked
      (see `docs/multi-repo.md` section 4)

Small pull requests get reviewed faster.

## Releases

Maintainers cut releases. SDK versions are semver on the package; the major
version tracks protocol compatibility, and the README table is the source of
truth. A release publishes the package (or, for now, a tarball on a GitHub
release) and is cut from a tag. Do not edit `deployments/testnet.json` in a
feature pull request; it is updated deliberately when the contract redeploys, in
dependency order.

## Security

Report vulnerabilities privately per `SECURITY.md`, never in a public issue. The
sensitive surfaces here are the hashing code and the signing paths. The project is
unaudited and Testnet-only.

## Community

Design discussion happens in this repository's GitHub Discussions. An SDK
repository grants triage and commit rights more readily than the contract
repository does, because the blast radius of a client bug is smaller than a
contract bug; even so, two merged pull requests earn triage rights on request. We
will not promise a review time we cannot keep, but smaller pull requests are
reviewed sooner.
