export type CustomerInput = { full_name: string; phone: string; email: string };

/** Returns an error message in Portuguese, or null when the customer data is valid. */
export function validateCustomer(input: CustomerInput): string | null {
  if (input.full_name.trim().length < 2) return "Informe o nome do cliente.";
  const email = input.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "E-mail inválido.";
  const digits = input.phone.replace(/\D/g, "");
  if (input.phone.trim() && (digits.length < 10 || digits.length > 13)) return "Telefone inválido (inclua o DDD).";
  return null;
}

export function matchesCustomerSearch(c: { full_name: string; phone: string | null; email: string | null }, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const digits = t.replace(/\D/g, "");
  return (
    norm(c.full_name).includes(norm(t)) ||
    (c.email ?? "").toLowerCase().includes(t) ||
    (digits.length > 0 && (c.phone ?? "").replace(/\D/g, "").includes(digits))
  );
}
