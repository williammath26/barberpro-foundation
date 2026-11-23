export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;

export const MAX_BARBER_NAME = 80;

export function validateBarberName(name: string): string | null {
  const n = name.trim();
  return n.length < 1 || n.length > MAX_BARBER_NAME ? "Informe um nome de 1 a 80 caracteres." : null;
}

/** "HH:MM" -> minutes since midnight, or null. */
export function timeToMinutes(t: string): number | null {
  const m = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export type Slot = { weekday: number; start: string; end: string };

/** Validates a working-hours slot against existing slots of the same barber. */
export function validateSlot(slot: Slot, existing: Slot[]): string | null {
  if (!Number.isInteger(slot.weekday) || slot.weekday < 0 || slot.weekday > 6) return "Escolha o dia da semana.";
  const s = timeToMinutes(slot.start);
  const e = timeToMinutes(slot.end);
  if (s === null || e === null) return "Informe início e fim.";
  if (e <= s) return "O fim do expediente precisa ser depois do início (não atravessa a meia-noite).";
  for (const x of existing) {
    if (x.weekday !== slot.weekday) continue;
    const xs = timeToMinutes(x.start);
    const xe = timeToMinutes(x.end);
    if (xs !== null && xe !== null && s < xe && xs < e) return "Esse horário se sobrepõe a outro do mesmo dia.";
  }
  return null;
}

export function validateTimeOff(startIso: string, endIso: string): string | null {
  const s = Date.parse(startIso);
  const e = Date.parse(endIso);
  if (Number.isNaN(s) || Number.isNaN(e)) return "Informe início e fim da folga.";
  if (e <= s) return "O fim da folga precisa ser depois do início.";
  return null;
}

export function shortTime(t: string): string {
  return t.slice(0, 5);
}
