# Hashing conventions

Umbra stores documents off chain and puts only their 32-byte hashes on chain:
the terms of an agreement, a seller's delivery proof, and a buyer's dispute
reason. The app that files a document and any adjudicator that later reads it must
compute the same hash, or verification fails. This is why the one canonical
implementation lives in the SDK (`src/hashing.ts`), not in the app.

## The scheme

A document hash is:

```
sha256( utf8( domain + "\n" + canonicalJSON(document) ) )
```

- **`document`** is any JSON value: the terms, proof, or reason object.
- **`canonicalJSON`** is the deterministic serialisation below.
- **`domain`** is a per-type separator so the same bytes hash differently as
  terms, as a proof, or as a reason, and one can never be replayed as another:
  - terms: `umbra:terms:v1`
  - delivery proof: `umbra:delivery-proof:v1`
  - dispute reason: `umbra:dispute-reason:v1`
- **`sha256`** is the same hash Soroban uses, imported from `@stellar/stellar-sdk`
  so on-chain and off-chain hashing cannot drift apart.

The `v1` suffix lets the scheme change later without silently accepting old
hashes: a `v2` domain produces different hashes, and both can be supported during
a migration.

## Canonical JSON

`canonicalize(value)` produces a single deterministic string:

- **Object keys are sorted** lexicographically, recursively. `{a,b}` and `{b,a}`
  serialise identically.
- **Arrays keep their order.** Order is meaningful in a list; it is not in an
  object.
- **Strings are Unicode-normalised to NFC**, so a precomposed `é` (U+00E9) and a
  decomposed `e`+`◌́` (U+0301) — the same text, different bytes — hash the same.
- **Numbers must be finite.** `NaN` and `Infinity` throw. Finite numbers use
  JSON's own shortest round-trip form.
- **No insignificant whitespace.**

This is a strict subset of [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785)
sufficient for Umbra's documents.

### A note on amounts

Represent monetary amounts as strings, not numbers, in any document you hash.
JavaScript numbers are IEEE-754 doubles and cannot hold every 64-bit integer
exactly; a string avoids the question entirely and matches how the contract
handles `i128` amounts.

## API

```ts
import {
  hashTerms,
  hashDeliveryProof,
  hashDisputeReason,
  verifyTerms,
  verifyDeliveryProof,
  verifyDisputeReason,
  canonicalize,
} from "@umbra-escrow-and-dispute-window/umbra-sdk";

const terms = { work: "translate one page", price: "50", currency: "USDC" };
const termsHash = hashTerms(terms); // 32-byte Buffer, pass as terms_hash

// Later, anyone can verify the on-chain hash against the document:
verifyTerms(terms, escrow.terms_hash); // true
```

Each `verify*` helper accepts the expected hash as a `Buffer`, a `Uint8Array`, or
a hex string, and returns a boolean. It never throws on a mismatch.

## Regenerating the contract bindings

`src/generated/` is generated from the deployed contract and committed. It is not
edited by hand. To regenerate after a contract change and redeploy:

```bash
stellar contract bindings typescript \
  --network testnet \
  --contract-id "$(node --input-type=module -e "import d from './deployments/testnet.json' with { type: 'json' }; console.log(d.contracts.escrow);")" \
  --output-dir /tmp/umbra-bindings --overwrite
cp /tmp/umbra-bindings/src/index.ts src/generated/index.ts
```

Then update `deployments/testnet.json` from the protocol repository's release and
bump this package per the compatibility table in the README.
