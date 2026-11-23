import { describe, expect, it } from "vitest";
import { validateBarberName, validateSlot, validateTimeOff } from "./barber-rules";

describe("barber rules", () => {
  it("requires a barber name", () => {
    expect(validateBarberName("  ")).not.toBeNull();
    expect(validateBarberName("João")).toBeNull();
  });
  it("rejects working hours ending before or at start", () => {
    expect(validateSlot({ weekday: 1, start: "18:00", end: "09:00" }, [])).not.toBeNull();
    expect(validateSlot({ weekday: 1, start: "09:00", end: "09:00" }, [])).not.toBeNull();
    expect(validateSlot({ weekday: 1, start: "09:00", end: "18:00" }, [])).toBeNull();
  });
  it("rejects overlapping working hours on the same day only", () => {
    const existing = [{ weekday: 1, start: "09:00", end: "12:00" }];
    expect(validateSlot({ weekday: 1, start: "11:00", end: "14:00" }, existing)).not.toBeNull();
    expect(validateSlot({ weekday: 1, start: "12:00", end: "18:00" }, existing)).toBeNull();
    expect(validateSlot({ weekday: 2, start: "09:00", end: "12:00" }, existing)).toBeNull();
  });
  it("rejects time off ending before start", () => {
    expect(validateTimeOff("2026-12-01T10:00", "2026-12-01T09:00")).not.toBeNull();
    expect(validateTimeOff("2026-12-01T09:00", "2026-12-01T18:00")).toBeNull();
  });
});
