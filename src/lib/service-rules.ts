export type ServiceDraft = {
  name: string;
  price: string;
  durationMinutes: string;
  description: string;
  isActive: boolean;
};

export type ServiceErrors = {
  name?: string;
  price?: string;
  durationMinutes?: string;
};

export const MIN_DURATION_MINUTES = 5;
export const MAX_DURATION_MINUTES = 480;
export const MAX_NAME_LENGTH = 120;

/** Accepts "35", "35,50", "35.50" and "1.234,56". Returns null when not a number. */
export function parseMoney(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

export function validateServiceDraft(draft: ServiceDraft): ServiceErrors {
  const errors: ServiceErrors = {};

  const name = draft.name.trim();
  if (name.length < 1 || name.length > MAX_NAME_LENGTH) {
    errors.name = "Informe um nome de 1 a 120 caracteres.";
  }

  const price = parseMoney(draft.price);
  if (price === null || price < 0) {
    errors.price = "Informe um preço válido, maior ou igual a zero.";
  }

  const duration = Number(draft.durationMinutes.trim());
  if (
    !Number.isInteger(duration) ||
    duration < MIN_DURATION_MINUTES ||
    duration > MAX_DURATION_MINUTES
  ) {
    errors.durationMinutes = `A duração deve ser um número inteiro entre ${MIN_DURATION_MINUTES} e ${MAX_DURATION_MINUTES} minutos.`;
  }

  return errors;
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(value)
    .replace("\u00a0", " ");
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}min`;
}
