# Security policy

Umbra is unaudited and Testnet-only. Do not use it to hold value you cannot
afford to lose, and do not point it at mainnet.

## Reporting a vulnerability

Report privately to **security@umbra-escrow.dev**. Do not open a public issue for
a vulnerability. Include what you found, how to reproduce it, and the impact you
see. You will get an acknowledgement, and we will agree a disclosure timeline
before anything is public. The same address is used for all three Umbra
repositories.

## Sensitive surfaces in this repository

This is the client, so the sensitive surfaces are where it produces bytes that
another party trusts:

- **Hashing (`src/hashing.ts`).** If canonicalisation drifts from the contract or
  the app, a document will not verify against its on-chain hash, or two documents
  could collide. Changes here are reviewed against `docs/hashing.md` and must keep
  the domain separators and the NFC normalisation. Never remove a domain
  separator.
- **Signing paths.** The SDK never holds a key; it takes a `signTransaction`
  callback. Do not add code that logs, stores, or transmits a secret key or a
  signed envelope beyond the call that submits it.
- **The vendored deployment.** `deployments/testnet.json` is the source of contract
  ids. Do not let a caller silently override it with an untrusted value without
  saying so.

## Scope

In scope: `src/`, the hashing conventions, and the build output. The generated
bindings in `src/generated/` mirror the contract; a bug there is usually a
contract-repository issue. The project is unaudited and Testnet-only.
