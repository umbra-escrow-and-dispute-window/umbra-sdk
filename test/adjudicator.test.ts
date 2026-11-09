import { describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import {
  buildSignedVerdictPayload,
  signVerdictPayload,
  verifyVerdictSignature,
  ADJUDICATOR_DOMAIN,
  verdict,
  ValidationError,
} from "../src/index.js";

describe("Signed adjudicator verdicts", () => {
  it("builds exact 32-byte canonical payload for RefundBuyer", () => {
    const payload = buildSignedVerdictPayload(1n, verdict.refundBuyer());
    expect(payload.length).toBe(32);

    // Bytes 0..19: domain
    expect(payload.subarray(0, 19).toString("utf8")).toBe(ADJUDICATOR_DOMAIN);
    // Bytes 19..27: escrowId 1
    expect(payload.readBigUInt64BE(19)).toBe(1n);
    // Byte 27: verdict tag 0
    expect(payload.readUInt8(27)).toBe(0);
    // Bytes 28..32: buyer_bps 0
    expect(payload.readUInt32BE(28)).toBe(0);
  });

  it("builds exact 32-byte canonical payload for ReleaseSeller", () => {
    const payload = buildSignedVerdictPayload(42n, verdict.releaseSeller());
    expect(payload.length).toBe(32);
    expect(payload.readBigUInt64BE(19)).toBe(42n);
    expect(payload.readUInt8(27)).toBe(1);
    expect(payload.readUInt32BE(28)).toBe(0);
  });

  it("builds exact 32-byte canonical payload for Split with basis points", () => {
    const payload = buildSignedVerdictPayload(100n, verdict.split(7500));
    expect(payload.length).toBe(32);
    expect(payload.readBigUInt64BE(19)).toBe(100n);
    expect(payload.readUInt8(27)).toBe(2);
    expect(payload.readUInt32BE(28)).toBe(7500);
  });

  it("rejects invalid split basis points", () => {
    expect(() =>
      buildSignedVerdictPayload(1n, verdict.split(10001)),
    ).toThrowError(ValidationError);
  });

  it("signs and verifies verdict payload with Ed25519 keypair", () => {
    const kp = Keypair.random();
    const payload = buildSignedVerdictPayload(5n, verdict.split(5000));

    const signature = signVerdictPayload(payload, kp);
    expect(signature.length).toBe(64);

    const valid = verifyVerdictSignature(payload, signature, kp.publicKey());
    expect(valid).toBe(true);

    // Tampered payload fails verification
    const tamperedPayload = Buffer.from(payload);
    tamperedPayload[27] = 0; // change verdict to RefundBuyer
    expect(
      verifyVerdictSignature(tamperedPayload, signature, kp.publicKey()),
    ).toBe(false);

    // Wrong public key fails verification
    const otherKp = Keypair.random();
    expect(
      verifyVerdictSignature(payload, signature, otherKp.publicKey()),
    ).toBe(false);
  });
});
