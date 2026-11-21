import { describe, expect, it } from "vitest";

import {
  formatBRL,
  formatDuration,
  parseMoney,
  validateServiceDraft,
  type ServiceDraft,
} from "./service-rules";

const base: ServiceDraft = {
  name: "Corte de cabelo",
  price: "45",
  durationMinutes: "45",
  description: "",
  isActive: true,
};

describe("parseMoney", () => {
  it("reads a Brazilian decimal price", () => {
    expect(parseMoney("35,50")).toBe(35.5);
  });

  it("reads a Brazilian thousands price", () => {
    expect(parseMoney("1.234,56")).toBe(1234.56);
  });

  it("rejects text that is not a number", () => {
    expect(parseMoney("abc")).toBeNull();
  });
});

describe("validateServiceDraft", () => {
  it("accepts a valid service", () => {
    expect(validateServiceDraft(base)).toEqual({});
  });

  it("rejects a negative price", () => {
    expect(validateServiceDraft({ ...base, price: "-1" }).price).toBe(
      "Informe um preço válido, maior ou igual a zero.",
    );
  });

  it("rejects a duration shorter than 5 minutes", () => {
    expect(validateServiceDraft({ ...base, durationMinutes: "4" }).durationMinutes).toBe(
      "A duração deve ser um número inteiro entre 5 e 480 minutos.",
    );
  });

  it("rejects a duration longer than 480 minutes", () => {
    expect(validateServiceDraft({ ...base, durationMinutes: "481" }).durationMinutes).toBe(
      "A duração deve ser um número inteiro entre 5 e 480 minutos.",
    );
  });

  it("rejects a blank name", () => {
    expect(validateServiceDraft({ ...base, name: "   " }).name).toBe(
      "Informe um nome de 1 a 120 caracteres.",
    );
  });
});

describe("formatting", () => {
  it("formats money in Brazilian reais", () => {
    expect(formatBRL(35.5)).toBe("R$ 35,50");
  });

  it("formats durations under an hour in minutes", () => {
    expect(formatDuration(45)).toBe("45 min");
  });

  it("formats exact hours", () => {
    expect(formatDuration(60)).toBe("1h");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(90)).toBe("1h 30min");
  });
});
