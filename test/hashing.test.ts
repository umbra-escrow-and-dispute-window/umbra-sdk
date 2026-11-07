import { describe, expect, it } from "vitest";
import vectorsFixture from "./vectors.json" with { type: "json" };
import {
  canonicalize,
  hashTerms,
  hashDeliveryProof,
  hashDisputeReason,
  verifyTerms,
  verifyDeliveryProof,
  verifyDisputeReason,
  DOMAIN,
  type JsonValue,
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

  it("rejects undefined, bigint, functions, and symbols with ValidationError", () => {
    expect(() => canonicalize(undefined as unknown as JsonValue)).toThrow(
      /cannot canonicalize undefined/,
    );
    expect(() => canonicalize({ val: 100n as unknown as JsonValue })).toThrow(
      /cannot canonicalize bigint/,
    );
    expect(() =>
      canonicalize({ fn: (() => {}) as unknown as JsonValue }),
    ).toThrow(/unsupported type/);
  });

  it("verify functions return false for null, empty, or mismatched hashes", () => {
    expect(verifyTerms({ a: 1 }, "")).toBe(false);
    expect(verifyDeliveryProof({ a: 1 }, null as unknown as string)).toBe(
      false,
    );
    expect(verifyDisputeReason({ a: 1 }, "badhex123")).toBe(false);
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

  it("handles deep structures and multicharacter unicode reliably", () => {
    const complex = {
      level1: {
        level2: [
          { name: "日本語", active: true },
          { name: "Español", active: false },
        ],
      },
    };
    expect(canonicalize(complex)).toBe(
      '{"level1":{"level2":[{"active":true,"name":"日本語"},{"active":false,"name":"Español"}]}}',
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

describe("cross-protocol conformance vectors (test/vectors.json)", () => {
  it("validates every test vector against canonical serialization and expected hashes", () => {
    for (const v of vectorsFixture.vectors) {
      const doc = v.document as unknown as JsonValue;
      expect(canonicalize(doc)).toBe(v.canonical_json);

      let computedHash: Buffer;
      if (v.domain === DOMAIN.terms) {
        computedHash = hashTerms(doc);
        expect(verifyTerms(doc, v.expected_hash)).toBe(true);
      } else if (v.domain === DOMAIN.deliveryProof) {
        computedHash = hashDeliveryProof(doc);
        expect(verifyDeliveryProof(doc, v.expected_hash)).toBe(true);
      } else if (v.domain === DOMAIN.disputeReason) {
        computedHash = hashDisputeReason(doc);
        expect(verifyDisputeReason(doc, v.expected_hash)).toBe(true);
      } else {
        throw new Error(`Unknown domain: ${v.domain}`);
      }

      expect(computedHash.toString("hex")).toBe(v.expected_hash);

      if ("alternate_document" in v) {
        const altDoc = v.alternate_document as unknown as JsonValue;
        expect(canonicalize(altDoc)).toBe(v.canonical_json);
        expect(hashTerms(altDoc).toString("hex")).toBe(v.expected_hash);
      }

      if ("decomposed_document" in v) {
        const decompDoc = v.decomposed_document as unknown as JsonValue;
        expect(canonicalize(decompDoc)).toBe(v.canonical_json);
        expect(hashTerms(decompDoc).toString("hex")).toBe(v.expected_hash);
      }
    }
  });
});
