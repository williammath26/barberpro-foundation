import { describe, expect, it } from "vitest";
import { todayInZone, utcIsoToZonedLocal, weekdayOf, zonedDayRange, zonedLocalToUtcIso } from "./timezone";

const FORTALEZA = "America/Fortaleza"; // UTC-3, sem horário de verão

describe("timezone", () => {
  it("converte hora local da loja para UTC, independente do fuso do navegador", () => {
    expect(zonedLocalToUtcIso("2026-12-01T10:00", FORTALEZA)).toBe("2026-12-01T13:00:00.000Z");
    expect(zonedLocalToUtcIso("2026-12-01T10:00", "Asia/Tokyo")).toBe("2026-12-01T01:00:00.000Z");
    expect(zonedLocalToUtcIso("2026-12-01T10:00", "UTC")).toBe("2026-12-01T10:00:00.000Z");
  });
  it("respeita horário de verão do fuso", () => {
    // São Paulo não tem DST; Nova York em julho é UTC-4, em janeiro UTC-5
    expect(zonedLocalToUtcIso("2026-07-01T09:00", "America/New_York")).toBe("2026-07-01T13:00:00.000Z");
    expect(zonedLocalToUtcIso("2026-01-15T09:00", "America/New_York")).toBe("2026-01-15T14:00:00.000Z");
  });
  it("rejeita valores inválidos", () => {
    expect(zonedLocalToUtcIso("", FORTALEZA)).toBeNull();
    expect(zonedLocalToUtcIso("amanhã", FORTALEZA)).toBeNull();
  });
  it("faz o caminho inverso para preencher inputs", () => {
    expect(utcIsoToZonedLocal("2026-12-01T13:00:00.000Z", FORTALEZA)).toBe("2026-12-01T10:00");
    expect(utcIsoToZonedLocal("2026-12-02T01:30:00.000Z", FORTALEZA)).toBe("2026-12-01T22:30");
  });
  it("calcula o dia e o intervalo do dia no fuso da loja", () => {
    expect(todayInZone(FORTALEZA, new Date("2026-12-02T02:00:00Z"))).toBe("2026-12-01");
    expect(zonedDayRange("2026-12-01", FORTALEZA)).toEqual({
      fromIso: "2026-12-01T03:00:00.000Z",
      toIso: "2026-12-02T03:00:00.000Z",
    });
    expect(zonedDayRange("2026-12-31", FORTALEZA).toIso).toBe("2027-01-01T03:00:00.000Z");
  });
  it("dia da semana do calendário", () => {
    expect(weekdayOf("2026-11-29")).toBe(0); // domingo
    expect(weekdayOf("2026-11-30")).toBe(1);
  });
});
