import { describe, it, expect } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("remove acentos e espaços", () => {
    expect(slugify("Barbearia do João  Ç")).toBe("barbearia-do-joao-c");
  });
  it("não começa nem termina com hífen", () => {
    expect(slugify("  --Corte & Barba!-- ")).toBe("corte-barba");
  });
});
