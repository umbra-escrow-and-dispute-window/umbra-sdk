import { scValToNative, xdr } from "@stellar/stellar-sdk";
import { State } from "./generated/index.js";

/** Represents a decoded transition event emitted by the Umbra escrow contract. */
export interface DecodedTransition {
  kind: string;
  escrowId: bigint;
  state: State;
}

/** Represents a decoded Astrolabe reputation attestation record event. */
export interface DecodedAttestationRecord {
  escrowId: bigint;
  buyer: string;
  seller: string;
  outcome: State;
  amountBucket: number;
}

/** Represents a Soroban RPC event or event-like object. */
export interface SorobanEventLike {
  topic?: readonly (xdr.ScVal | string)[];
  value?: xdr.ScVal | { xdr?: string } | string;
  [key: string]: unknown;
}

function parseScVal(val: xdr.ScVal | { xdr?: string } | string): xdr.ScVal {
  if (typeof val === "string") {
    return xdr.ScVal.fromXDR(val, "base64");
  }
  if ("xdr" in val && typeof val.xdr === "string") {
    return xdr.ScVal.fromXDR(val.xdr, "base64");
  }
  return val as xdr.ScVal;
}

/**
 * Decodes an Umbra contract transition event into typed fields.
 * Returns null if the event is not an Umbra Transition event with topics ("umbra", kind, escrow_id).
 */
export function decodeTransition(
  event: SorobanEventLike,
): DecodedTransition | null {
  if (!event || !event.topic || event.topic.length < 3 || !event.value) {
    return null;
  }

  const t0 = event.topic[0];
  const t1 = event.topic[1];
  const t2 = event.topic[2];
  if (!t0 || !t1 || !t2) {
    return null;
  }

  try {
    const topic0ScVal = parseScVal(t0);
    const topic0 = scValToNative(topic0ScVal);
    if (topic0 !== "umbra") {
      return null;
    }

    const topic1ScVal = parseScVal(t1);
    const kind = String(scValToNative(topic1ScVal));

    const topic2ScVal = parseScVal(t2);
    const escrowIdNative = scValToNative(topic2ScVal);
    const escrowId =
      typeof escrowIdNative === "bigint"
        ? escrowIdNative
        : BigInt(escrowIdNative);

    const valueScVal = parseScVal(event.value);
    const stateNative = scValToNative(valueScVal);
    const state = Number(stateNative) as State;

    return {
      kind,
      escrowId,
      state,
    };
  } catch {
    return null;
  }
}

/**
 * Decodes an Astrolabe terminal attestation record event.
 * Topics: ["astrolabe", "record", escrow_id]
 */
export function decodeAttestationRecord(
  event: SorobanEventLike,
): DecodedAttestationRecord | null {
  if (!event || !event.topic || event.topic.length < 3 || !event.value) {
    return null;
  }

  try {
    const t0 = event.topic[0];
    const t1 = event.topic[1];
    const t2 = event.topic[2];

    if (!t0 || !t1 || !t2) {
      return null;
    }

    const t0Val = parseScVal(t0);
    const t1Val = parseScVal(t1);
    const t2Val = parseScVal(t2);

    if (
      scValToNative(t0Val) !== "astrolabe" ||
      scValToNative(t1Val) !== "record"
    ) {
      return null;
    }

    const escrowIdNative = scValToNative(t2Val);
    const escrowId =
      typeof escrowIdNative === "bigint"
        ? escrowIdNative
        : BigInt(escrowIdNative);

    const valScVal = parseScVal(event.value);
    const nativeVal = scValToNative(valScVal) as {
      buyer: string;
      seller: string;
      outcome: number | State;
      amount_bucket: number;
    };

    return {
      escrowId,
      buyer: String(nativeVal.buyer),
      seller: String(nativeVal.seller),
      outcome: Number(nativeVal.outcome) as State,
      amountBucket: Number(nativeVal.amount_bucket),
    };
  } catch {
    return null;
  }
}

/**
 * Filters an array of Soroban events for decoded Transition events matching a specific escrow ID.
 */
export function filterEscrowEvents(
  events: readonly SorobanEventLike[],
  escrowId: bigint | number | string,
): DecodedTransition[] {
  const targetId = BigInt(escrowId);
  const result: DecodedTransition[] = [];

  for (const event of events) {
    const transition = decodeTransition(event);
    if (transition && transition.escrowId === targetId) {
      result.push(transition);
    }
  }

  return result;
}
