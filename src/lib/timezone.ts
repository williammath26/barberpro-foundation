/**
 * Conversões de data/hora no fuso da barbearia (barbershops.timezone), independentes
 * do fuso do navegador. Só usa Intl (sem dependências novas).
 */

function zonedParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  return {
    year: p["year"] ?? 0,
    month: p["month"] ?? 1,
    day: p["day"] ?? 1,
    hour: (p["hour"] ?? 0) % 24,
    minute: p["minute"] ?? 0,
    second: p["second"] ?? 0,
  };
}

/** Diferença (ms) entre o relógio do fuso e o UTC no instante dado. */
function offsetMs(date: Date, timeZone: string): number {
  const z = zonedParts(date, timeZone);
  const asUtc = Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute, z.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

/** "YYYY-MM-DDTHH:mm" no fuso da loja -> ISO UTC. null se inválido. */
export function zonedLocalToUtcIso(local: string, timeZone: string): string | null {
  const m = LOCAL_RE.exec(local.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let ts = guess - offsetMs(new Date(guess), timeZone);
  const second = guess - offsetMs(new Date(ts), timeZone);
  if (second !== ts) ts = second; // ajuste perto de troca de horário de verão
  return new Date(ts).toISOString();
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO -> "YYYY-MM-DDTHH:mm" no fuso da loja (valor para input datetime-local). */
export function utcIsoToZonedLocal(iso: string, timeZone: string): string {
  const z = zonedParts(new Date(iso), timeZone);
  return `${z.year}-${pad(z.month)}-${pad(z.day)}T${pad(z.hour)}:${pad(z.minute)}`;
}

/** Data de hoje ("YYYY-MM-DD") no fuso da loja. */
export function todayInZone(timeZone: string, now: Date = new Date()): string {
  return utcIsoToZonedLocal(now.toISOString(), timeZone).slice(0, 10);
}

/** Intervalo UTC [início, fim) do dia "YYYY-MM-DD" no fuso da loja. */
export function zonedDayRange(ymd: string, timeZone: string): { fromIso: string; toIso: string } {
  const fromIso = zonedLocalToUtcIso(`${ymd}T00:00`, timeZone) ?? "";
  const next = new Date(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)) + 1));
  const nextYmd = next.toISOString().slice(0, 10);
  const toIso = zonedLocalToUtcIso(`${nextYmd}T00:00`, timeZone) ?? "";
  return { fromIso, toIso };
}

/** Dia da semana (0=domingo) de uma data "YYYY-MM-DD" do calendário. */
export function weekdayOf(ymd: string): number {
  return new Date(`${ymd}T12:00:00Z`).getUTCDay();
}

/** Formata um instante no fuso da loja, em pt-BR. */
export function formatInZone(iso: string, timeZone: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone, ...opts }).format(new Date(iso));
}
