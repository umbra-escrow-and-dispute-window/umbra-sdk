import { describe, expect, it } from "vitest";
import {
  canonicalize,
  hashTerms,
  hashDeliveryProof,
  hashDisputeReason,
  verifyTerms,
  verifyDeliveryProof,
  verifyDisputeReason,
  DOMAIN,
} from "../src/index.js";

describe("canonicalize", () => {
  it("is independent of object key order", () => {
    expect(canonicalize({ a: 1, b: 2 })).toBe(canonicalize({ b: 2, a: 1 }));
  });

  it("sorts keys recursively", () => {
    const s = canonicalize({ z: { y: 1, x: 2 }, a: [3, 2, 1] });
    expect(s).toBe('{"a":[3,2,1],"z":{"x":2,"y":1}}');
  });

  it("preserves array order", () => {
    expect(canonicalize([3, 1, 2])).toBe("[3,1,2]");
  });

  it("normalises unicode to NFC", () => {
    // U+00E9 (precomposed) vs "e" + U+0301 (combining acute): same text, different bytes.
    const composed = { name: "café" };
    const decomposed = { name: "café" };
    expect(composed.name).not.toBe(decomposed.name);
    expect(canonicalize(composed)).toBe(canonicalize(decomposed));
  });

  it("formats integers without a decimal point", () => {
    expect(canonicalize({ n: 1 })).toBe('{"n":1}');
    expect(canonicalize({ n: 1000000 })).toBe('{"n":1000000}');
    expect(canonicalize({ frac: 0.125 })).toBe('{"frac":0.125}');
  });

  it("rejects non-finite numbers", () => {
    expect(() => canonicalize({ n: Infinity })).toThrow();
    expect(() => canonicalize({ n: NaN })).toThrow();
  });

  it("handles null and booleans", () => {
    expect(canonicalize({ a: null, b: true, c: false })).toBe(
      '{"a":null,"b":true,"c":false}',
    );
  });

  it("handles empty structures and negative numbers", () => {
    expect(canonicalize({})).toBe("{}");
    expect(canonicalize([])).toBe("[]");
    expect(canonicalize({ emptyObj: {}, emptyArr: [] })).toBe(
      '{"emptyArr":[],"emptyObj":{}}',
    );
    expect(canonicalize({ neg: -42, zero: 0 })).toBe('{"neg":-42,"zero":0}');
  });

  it("handles escaped string characters and symbols", () => {
    expect(canonicalize({ text: 'line 1\nline 2\t"quoted"' })).toBe(
      '{"text":"line 1\\nline 2\\t\\"quoted\\""}',
    );
  });
});

describe("document hashing", () => {
  it("produces a 32-byte hash", () => {
    expect(hashTerms({ work: "translate a page" }).length).toBe(32);
  });

  it("is stable across key order", () => {
    const a = hashTerms({ work: "x", price: "10" });
    const b = hashTerms({ price: "10", work: "x" });
    expect(a.equals(b)).toBe(true);
  });

  it("separates domains: same body hashes differently per document type", () => {
    const body = { note: "same bytes" };
    const t = hashTerms(body);
    const d = hashDeliveryProof(body);
    const r = hashDisputeReason(body);
    expect(t.equals(d)).toBe(false);
    expect(t.equals(r)).toBe(false);
    expect(d.equals(r)).toBe(false);
  });

  it("verifies against its own hash, as hex and as bytes", () => {
    const terms = { work: "x", price: "10" };
    const h = hashTerms(terms);
    expect(verifyTerms(terms, h)).toBe(true);
    expect(verifyTerms(terms, new Uint8Array(h))).toBe(true);
    expect(verifyTerms(terms, h.toString("hex"))).toBe(true);
    expect(verifyTerms({ work: "y" }, h)).toBe(false);
    expect(verifyTerms(terms, Buffer.alloc(16))).toBe(false);
    expect(verifyTerms(terms, "abcd")).toBe(false);

    const proof = { url: "https://example.com/delivery" };
    const proofHash = hashDeliveryProof(proof);
    expect(verifyDeliveryProof(proof, proofHash)).toBe(true);
    expect(verifyDeliveryProof(proof, proofHash.toString("hex"))).toBe(true);
    expect(
      verifyDeliveryProof({ url: "https://example.com/other" }, proofHash),
    ).toBe(false);

    const reason = { note: "work not delivered as promised" };
    const reasonHash = hashDisputeReason(reason);
    expect(verifyDisputeReason(reason, reasonHash)).toBe(true);
    expect(verifyDisputeReason(reason, reasonHash.toString("hex"))).toBe(true);
    expect(verifyDisputeReason({ note: "other reason" }, reasonHash)).toBe(
      false,
    );
  });

  it("exposes versioned domain separators", () => {
    expect(DOMAIN.terms).toBe("umbra:terms:v1");
    expect(DOMAIN.deliveryProof).toBe("umbra:delivery-proof:v1");
    expect(DOMAIN.disputeReason).toBe("umbra:dispute-reason:v1");
  });
});
