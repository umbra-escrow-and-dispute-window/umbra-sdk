import { describe, expect, it } from "vitest";
import { xdr } from "@stellar/stellar-sdk";
import {
  decodeTransition,
  filterEscrowEvents,
  State,
  type SorobanEventLike,
} from "../src/index.js";

describe("events decoding and filtering", () => {
  function makeEvent(kind: string, escrowId: bigint, state: State) {
    const t0 = xdr.ScVal.scvSymbol("umbra");
    const t1 = xdr.ScVal.scvSymbol(kind);
    const t2 = xdr.ScVal.scvU64(new xdr.Uint64(escrowId));
    const val = xdr.ScVal.scvU32(state);

    return {
      topic: [t0, t1, t2],
      value: val,
    };
  }

  it("decodes a valid transition event with ScVal objects", () => {
    const event = makeEvent("create", 12n, State.Created);
    const decoded = decodeTransition(event);

    expect(decoded).not.toBeNull();
    expect(decoded?.kind).toBe("create");
    expect(decoded?.escrowId).toBe(12n);
    expect(decoded?.state).toBe(State.Created);
  });

  it("decodes a valid transition event with base64 XDR strings", () => {
    const event = makeEvent("fund", 99n, State.Funded);
    const base64Event = {
      topic: [
        (event.topic[0] as xdr.ScVal).toXDR("base64"),
        (event.topic[1] as xdr.ScVal).toXDR("base64"),
        (event.topic[2] as xdr.ScVal).toXDR("base64"),
      ],
      value: { xdr: (event.value as xdr.ScVal).toXDR("base64") },
    };

    const decoded = decodeTransition(base64Event);
    expect(decoded).not.toBeNull();
    expect(decoded?.kind).toBe("fund");
    expect(decoded?.escrowId).toBe(99n);
    expect(decoded?.state).toBe(State.Funded);
  });

  it("returns null for non-umbra topics or malformed events", () => {
    expect(decodeTransition(null as unknown as SorobanEventLike)).toBeNull();
    expect(decodeTransition({} as unknown as SorobanEventLike)).toBeNull();
    expect(
      decodeTransition({
        topic: [
          xdr.ScVal.scvSymbol("other"),
          xdr.ScVal.scvSymbol("kind"),
          xdr.ScVal.scvU64(new xdr.Uint64(1n)),
        ],
        value: xdr.ScVal.scvU32(0),
      }),
    ).toBeNull();
  });

  it("filters a list of events for a target escrow id", () => {
    const ev1 = makeEvent("create", 10n, State.Created);
    const ev2 = makeEvent("fund", 20n, State.Funded);
    const ev3 = makeEvent("fund", 10n, State.Funded);
    const nonUmbra = {
      topic: [
        xdr.ScVal.scvSymbol("contract"),
        xdr.ScVal.scvSymbol("noop"),
        xdr.ScVal.scvU64(new xdr.Uint64(10n)),
      ],
      value: xdr.ScVal.scvU32(0),
    };

    const results = filterEscrowEvents([ev1, ev2, ev3, nonUmbra], 10n);
    expect(results).toHaveLength(2);
    expect(results[0]?.kind).toBe("create");
    expect(results[1]?.kind).toBe("fund");
    expect(results.every((r) => r.escrowId === 10n)).toBe(true);
  });
});
