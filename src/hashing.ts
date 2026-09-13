import { hash as sha256 } from "@stellar/stellar-sdk";

/**
 * Off-chain document hashing for Umbra.
 *
 * Terms, delivery proofs, and dispute reasons live off chain; the contract
 * stores only their 32-byte hashes. The app and any third-party adjudicator must
 * produce identical hashes, so this is the one canonical implementation. The
 * scheme is documented in docs/hashing.md.
 *
 * A hash is sha256 over `domain + "\n" + canonicalJSON(document)`, UTF-8 encoded.
 * The domain separator makes a terms document and a dispute-reason document with
 * the same body hash differently, so one can never be replayed as the other.
 */

export const DOMAIN = {
  terms: "umbra:terms:v1",
  deliveryProof: "umbra:delivery-proof:v1",
  disputeReason: "umbra:dispute-reason:v1",
} as const;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * Deterministic JSON. Object keys are sorted, strings are Unicode-normalised to
 * NFC so that visually identical text hashes identically, and numbers must be
 * finite. There is no insignificant whitespace. This is a strict subset of
 * RFC 8785 sufficient for Umbra's documents.
 */
export function canonicalize(value: JsonValue): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("cannot canonicalize a non-finite number");
    }
    // JSON's own number formatting is stable for finite values: integers stay
    // integers, and there is a single shortest round-trip form.
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value.normalize("NFC"));
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  const keys = Object.keys(value).sort();
  const members = keys.map(
    (k) => JSON.stringify(k.normalize("NFC")) + ":" + canonicalize(value[k]!),
  );
  return "{" + members.join(",") + "}";
}

function digest(domain: string, document: JsonValue): Buffer {
  const payload = domain + "\n" + canonicalize(document);
  return sha256(Buffer.from(payload, "utf-8"));
}

export function hashTerms(terms: JsonValue): Buffer {
  return digest(DOMAIN.terms, terms);
}

export function hashDeliveryProof(proof: JsonValue): Buffer {
  return digest(DOMAIN.deliveryProof, proof);
}

export function hashDisputeReason(reason: JsonValue): Buffer {
  return digest(DOMAIN.disputeReason, reason);
}

function equals(a: Buffer, expected: Buffer | Uint8Array | string): boolean {
  const other =
    typeof expected === "string"
      ? Buffer.from(expected, "hex")
      : Buffer.from(expected);
  return a.length === other.length && a.equals(other);
}

export function verifyTerms(
  terms: JsonValue,
  expected: Buffer | Uint8Array | string,
): boolean {
  return equals(hashTerms(terms), expected);
}

export function verifyDeliveryProof(
  proof: JsonValue,
  expected: Buffer | Uint8Array | string,
): boolean {
  return equals(hashDeliveryProof(proof), expected);
}

export function verifyDisputeReason(
  reason: JsonValue,
  expected: Buffer | Uint8Array | string,
): boolean {
  return equals(hashDisputeReason(reason), expected);
}
