import { zonedLocalToUtcIso } from "@/lib/timezone";

export type Window = { start_time: string; end_time: string };
export type Busy = { starts_at: string; ends_at: string };
export type Slot = { label: string; startIso: string };

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/**
 * Horários livres de um barbeiro num dia (no fuso da loja): cabem inteiros num
 * expediente, não colidem com agendamentos/folgas (busy) e não estão no passado.
 * O banco continua sendo a garantia final (trigger + EXCLUDE constraint).
 */
export function computeFreeSlots(args: {
  ymd: string;
  timeZone: string;
  windows: Window[];
  durationMin: number;
  busy: Busy[];
  now?: Date;
  stepMin?: number;
}): Slot[] {
  const { ymd, timeZone, windows, durationMin, busy, now = new Date(), stepMin = 15 } = args;
  if (durationMin <= 0) return [];
  const busyMs = busy.map((b) => [Date.parse(b.starts_at), Date.parse(b.ends_at)] as const);
  const out: Slot[] = [];
  const seen = new Set<string>();
  for (const w of [...windows].sort((a, b) => toMin(a.start_time) - toMin(b.start_time))) {
    const end = toMin(w.end_time);
    for (let m = toMin(w.start_time); m + durationMin <= end; m += stepMin) {
      const label = toHHMM(m);
      const startIso = zonedLocalToUtcIso(`${ymd}T${label}`, timeZone);
      if (!startIso || seen.has(startIso)) continue;
      const s = Date.parse(startIso);
      const e = s + durationMin * 60_000;
      if (s < now.getTime()) continue;
      if (busyMs.some(([bs, be]) => s < be && bs < e)) continue;
      seen.add(startIso);
      out.push({ label, startIso });
    }
  }
  return out;
}

/** Mensagem amigável para erros ao criar agendamento. */
export function describeAppointmentError(error: { code?: string | null; message?: string | null }): string {
  if (error.code === "23P01") return "Esse horário acabou de ser ocupado. Escolha outro.";
  if (error.code === "P0001" && error.message) return error.message; // mensagens do trigger, já em pt-BR
  return "Não foi possível salvar o agendamento. Tente novamente.";
}

export const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Faltou",
};
