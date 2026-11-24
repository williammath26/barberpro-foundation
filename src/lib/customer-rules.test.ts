import { describe, expect, it } from "vitest";
import { matchesCustomerSearch, validateCustomer } from "./customer-rules";

describe("validateCustomer", () => {
  it("requires a name", () => {
    expect(validateCustomer({ full_name: " ", phone: "", email: "" })).toBe("Informe o nome do cliente.");
  });
  it("accepts name only", () => {
    expect(validateCustomer({ full_name: "João", phone: "", email: "" })).toBeNull();
  });
  it("rejects bad email", () => {
    expect(validateCustomer({ full_name: "João", phone: "", email: "joao@" })).toBe("E-mail inválido.");
  });
  it("rejects phone without area code", () => {
    expect(validateCustomer({ full_name: "João", phone: "9999-1234", email: "" })).toBe("Telefone inválido (inclua o DDD).");
  });
});

describe("matchesCustomerSearch", () => {
  const c = { full_name: "José Araújo", phone: "(85) 99999-1234", email: "jose@x.com" };
  it("ignores accents in name", () => expect(matchesCustomerSearch(c, "jose arau")).toBe(true));
  it("matches phone digits", () => expect(matchesCustomerSearch(c, "99999 1234")).toBe(true));
  it("rejects non-match", () => expect(matchesCustomerSearch(c, "maria")).toBe(false));
});
