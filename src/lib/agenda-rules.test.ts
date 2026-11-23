import { describe, expect, it } from "vitest";
import { computeFreeSlots, describeAppointmentError } from "./agenda-rules";

const TZ = "America/Fortaleza";
const base = { ymd: "2026-12-01", timeZone: TZ, now: new Date("2026-11-01T00:00:00Z"), stepMin: 30 };

describe("computeFreeSlots", () => {
  it("lista horários que cabem inteiros no expediente", () => {
    const slots = computeFreeSlots({ ...base, windows: [{ start_time: "09:00:00", end_time: "11:00:00" }], durationMin: 60, busy: [] });
    expect(slots.map((s) => s.label)).toEqual(["09:00", "09:30", "10:00"]);
    expect(slots[0]?.startIso).toBe("2026-12-01T12:00:00.000Z");
  });
  it("bloqueia horários ocupados (agendamento ou folga)", () => {
    const busy = [{ starts_at: "2026-12-01T12:30:00.000Z", ends_at: "2026-12-01T13:00:00.000Z" }]; // 09:30–10:00 local
    const slots = computeFreeSlots({ ...base, windows: [{ start_time: "09:00:00", end_time: "11:00:00" }], durationMin: 30, busy });
    expect(slots.map((s) => s.label)).toEqual(["09:00", "10:00", "10:30"]);
  });
  it("não oferece horários no passado", () => {
    const slots = computeFreeSlots({ ...base, now: new Date("2026-12-01T13:10:00Z"), windows: [{ start_time: "09:00:00", end_time: "11:00:00" }], durationMin: 30, busy: [] });
    expect(slots.map((s) => s.label)).toEqual(["10:30"]);
  });
  it("sem expediente, sem horários", () => {
    expect(computeFreeSlots({ ...base, windows: [], durationMin: 30, busy: [] })).toEqual([]);
  });
});

describe("describeAppointmentError", () => {
  it("traduz conflito de horário e repassa mensagens do banco", () => {
    expect(describeAppointmentError({ code: "23P01", message: "conflicting key value violates exclusion constraint" })).toMatch(/ocupado/);
    expect(describeAppointmentError({ code: "P0001", message: "Horário fora do expediente do barbeiro" })).toBe("Horário fora do expediente do barbeiro");
    expect(describeAppointmentError({ code: "42501", message: "rls" })).toMatch(/Não foi possível/);
  });
});
