import { Keypair } from "@stellar/stellar-sdk";
import type { Verdict } from "./generated/index.js";
import { ValidationError } from "./validation.js";

export const ADJUDICATOR_DOMAIN = "umbra:adjudicate:v1";

/**
 * Builds the canonical 32-byte payload verified by `contracts/escrow` in `resolve_signed`.
 * Layout:
 * - Bytes 0..19 (19 bytes): ASCII `umbra:adjudicate:v1`
 * - Bytes 19..27 (8 bytes): `escrow_id` as big-endian 64-bit unsigned integer
 * - Byte 27 (1 byte): verdict tag (0 for RefundBuyer, 1 for ReleaseSeller, 2 for Split)
 * - Bytes 28..32 (4 bytes): buyer basis points as big-endian 32-bit unsigned integer (0 if not Split)
 */
export function buildSignedVerdictPayload(
  escrowId: bigint | number,
  verdict: Verdict,
): Buffer {
  const buf = Buffer.alloc(32);

  // 1. Domain separator (19 bytes)
  const domainBytes = Buffer.from(ADJUDICATOR_DOMAIN, "utf8");
  domainBytes.copy(buf, 0);

  // 2. Escrow ID (8 bytes big-endian)
  const idBigInt = BigInt(escrowId);
  if (idBigInt < 0n) {
    throw new ValidationError("escrowId cannot be negative", "escrowId");
  }
  buf.writeBigUInt64BE(idBigInt, 19);

  // 3. Verdict tag (1 byte) and 4. buyer_bps (4 bytes big-endian)
  switch (verdict.tag) {
    case "RefundBuyer":
      buf.writeUInt8(0, 27);
      buf.writeUInt32BE(0, 28);
      break;
    case "ReleaseSeller":
      buf.writeUInt8(1, 27);
      buf.writeUInt32BE(0, 28);
      break;
    case "Split": {
      const bps = verdict.values[0];
      if (!Number.isInteger(bps) || bps < 0 || bps > 10000) {
        throw new ValidationError(
          `buyer_bps must be between 0 and 10000, got ${bps}`,
          "buyerBps",
        );
      }
      buf.writeUInt8(2, 27);
      buf.writeUInt32BE(bps, 28);
      break;
    }
    default:
      throw new ValidationError(
        // @ts-expect-error exhaustiveness check
        `Unknown verdict tag: ${verdict.tag}`,
        "verdict",
      );
  }

  return buf;
}

/**
 * Signs an adjudicator verdict payload using an Ed25519 Stellar Keypair or secret key.
 * Returns a 64-byte signature Buffer.
 */
export function signVerdictPayload(
  payload: Buffer | Uint8Array,
  signer: Keypair | string | Uint8Array,
): Buffer {
  const payloadBuf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  if (payloadBuf.length !== 32) {
    throw new ValidationError(
      `Payload must be exactly 32 bytes, got ${payloadBuf.length}`,
      "payload",
    );
  }

  let kp: Keypair;
  if (signer instanceof Keypair) {
    kp = signer;
  } else if (typeof signer === "string") {
    kp = signer.startsWith("S")
      ? Keypair.fromSecret(signer)
      : Keypair.fromRawEd25519Seed(Buffer.from(signer, "hex"));
  } else {
    kp = Keypair.fromRawEd25519Seed(Buffer.from(signer));
  }

  return Buffer.from(kp.sign(payloadBuf));
}

/**
 * Verifies an Ed25519 signature over a 32-byte adjudicator verdict payload.
 */
export function verifyVerdictSignature(
  payload: Buffer | Uint8Array,
  signature: Buffer | Uint8Array,
  verifier: Keypair | string | Uint8Array,
): boolean {
  try {
    const payloadBuf = Buffer.isBuffer(payload)
      ? payload
      : Buffer.from(payload);
    const sigBuf = Buffer.isBuffer(signature)
      ? signature
      : Buffer.from(signature);

    if (payloadBuf.length !== 32 || sigBuf.length !== 64) {
      return false;
    }

    let kp: Keypair;
    if (verifier instanceof Keypair) {
      kp = verifier;
    } else if (typeof verifier === "string") {
      kp = verifier.startsWith("G")
        ? Keypair.fromPublicKey(verifier)
        : verifier.startsWith("S")
          ? Keypair.fromSecret(verifier)
          : Keypair.fromRawEd25519Seed(Buffer.from(verifier, "hex"));
    } else {
      kp = Keypair.fromRawEd25519Seed(Buffer.from(verifier));
    }

    return kp.verify(payloadBuf, sigBuf);
  } catch {
    return false;
  }
}
