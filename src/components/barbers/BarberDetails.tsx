import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WEEKDAYS, shortTime, validateSlot, validateTimeOff } from "@/lib/barber-rules";

type Barber = Database["public"]["Tables"]["barbers"]["Row"];

type Props = { barber: Barber; shopId: string; canManage: boolean };

function fail(e: unknown) {
  const msg = e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "";
  toast.error(msg.includes("overlap") || msg.includes("exclusion") ? "Horário sobreposto a outro já cadastrado." : "Não foi possível salvar. Tente novamente.");
}

export function BarberDetails({ barber, shopId, canManage }: Props) {
  const qc = useQueryClient();
  const key = (k: string) => [k, shopId, barber.id];

  const services = useQuery({
    queryKey: ["services", shopId],
    queryFn: async () => {
      // Mesma chave e shape da tela /servicos (select *), para o cache nunca divergir.
      const { data, error } = await supabase.from("services").select("*").eq("barbershop_id", shopId).order("name");
      if (error) throw error;
      return data;
    },
  });
  const links = useQuery({
    queryKey: key("barber-services"),
    queryFn: async () => {
      const { data, error } = await supabase.from("barber_services").select("service_id").eq("barber_id", barber.id).eq("barbershop_id", shopId);
      if (error) throw error;
      return new Set(data.map((d) => d.service_id));
    },
  });
  const hours = useQuery({
    queryKey: key("working-hours"),
    queryFn: async () => {
      const { data, error } = await supabase.from("working_hours").select("*").eq("barber_id", barber.id).eq("barbershop_id", shopId).order("weekday").order("start_time");
      if (error) throw error;
      return data;
    },
  });
  const timeOff = useQuery({
    queryKey: key("time-off"),
    queryFn: async () => {
      const { data, error } = await supabase.from("barber_time_off").select("*").eq("barber_id", barber.id).eq("barbershop_id", shopId).gte("ends_at", new Date().toISOString()).order("starts_at");
      if (error) throw error;
      return data;
    },
  });

  async function toggleService(serviceId: string, on: boolean) {
    const q = on
      ? supabase.from("barber_services").insert({ barbershop_id: shopId, barber_id: barber.id, service_id: serviceId })
      : supabase.from("barber_services").delete().eq("barbershop_id", shopId).eq("barber_id", barber.id).eq("service_id", serviceId);
    const { error } = await q;
    if (error) return fail(error);
    qc.invalidateQueries({ queryKey: key("barber-services") });
  }

  const [weekday, setWeekday] = useState("1");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  async function addSlot() {
    const existing = (hours.data ?? []).map((h) => ({ weekday: h.weekday, start: shortTime(h.start_time), end: shortTime(h.end_time) }));
    const err = validateSlot({ weekday: Number(weekday), start, end }, existing);
    if (err) return toast.error(err);
    const { error } = await supabase.from("working_hours").insert({ barbershop_id: shopId, barber_id: barber.id, weekday: Number(weekday), start_time: start, end_time: end });
    if (error) return fail(error);
    qc.invalidateQueries({ queryKey: key("working-hours") });
  }
  async function removeSlot(id: string) {
    const { error } = await supabase.from("working_hours").delete().eq("id", id).eq("barbershop_id", shopId);
    if (error) return fail(error);
    qc.invalidateQueries({ queryKey: key("working-hours") });
  }

  const [offStart, setOffStart] = useState("");
  const [offEnd, setOffEnd] = useState("");
  const [reason, setReason] = useState("");
  async function addTimeOff() {
    const err = validateTimeOff(offStart, offEnd);
    if (err) return toast.error(err);
    const { error } = await supabase.from("barber_time_off").insert({
      barbershop_id: shopId,
      barber_id: barber.id,
      starts_at: new Date(offStart).toISOString(),
      ends_at: new Date(offEnd).toISOString(),
      reason: reason.trim() || null,
    });
    if (error) return fail(error);
    setOffStart(""); setOffEnd(""); setReason("");
    qc.invalidateQueries({ queryKey: key("time-off") });
  }
  async function removeTimeOff(id: string) {
    const { error } = await supabase.from("barber_time_off").delete().eq("id", id).eq("barbershop_id", shopId);
    if (error) return fail(error);
    qc.invalidateQueries({ queryKey: key("time-off") });
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="mt-4 grid gap-6 border-t border-border pt-4">
      <section>
        <h4 className="font-semibold">Serviços que faz</h4>
        {!services.data?.length ? (
          <p className="mt-1 text-sm text-muted-foreground">Cadastre serviços primeiro na tela Serviços.</p>
        ) : (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {services.data.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={links.data?.has(s.id) ?? false}
                  disabled={!canManage}
                  onCheckedChange={(v) => toggleService(s.id, v === true)}
                />
                {s.name}
                {!s.is_active && <span className="text-muted-foreground">(inativo)</span>}
              </label>
            ))}
          </div>
        )}
      </section>

      <section>
        <h4 className="font-semibold">Expediente semanal</h4>
        {!hours.data?.length ? (
          <p className="mt-1 text-sm text-muted-foreground">Nenhum horário cadastrado.</p>
        ) : (
          <ul className="mt-2 grid gap-1 text-sm">
            {hours.data.map((h) => (
              <li key={h.id} className="flex items-center justify-between rounded border border-border px-3 py-1.5">
                <span>{WEEKDAYS[h.weekday]} · {shortTime(h.start_time)} – {shortTime(h.end_time)}</span>
                {canManage && <Button variant="ghost" size="sm" onClick={() => removeSlot(h.id)}>Remover</Button>}
              </li>
            ))}
          </ul>
        )}
        {canManage && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="grid gap-1">
              <Label>Dia</Label>
              <Select value={weekday} onValueChange={setWeekday}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((d, i) => <SelectItem key={d} value={String(i)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1"><Label>Início</Label><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="w-28" /></div>
            <div className="grid gap-1"><Label>Fim</Label><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="w-28" /></div>
            <Button size="sm" onClick={addSlot}>Adicionar horário</Button>
          </div>
        )}
      </section>

      <section>
        <h4 className="font-semibold">Folgas e bloqueios</h4>
        {!timeOff.data?.length ? (
          <p className="mt-1 text-sm text-muted-foreground">Nenhuma folga futura.</p>
        ) : (
          <ul className="mt-2 grid gap-1 text-sm">
            {timeOff.data.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded border border-border px-3 py-1.5">
                <span>{fmt(t.starts_at)} → {fmt(t.ends_at)}{t.reason ? ` · ${t.reason}` : ""}</span>
                {canManage && <Button variant="ghost" size="sm" onClick={() => removeTimeOff(t.id)}>Remover</Button>}
              </li>
            ))}
          </ul>
        )}
        {canManage && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="grid gap-1"><Label>Início</Label><Input type="datetime-local" value={offStart} onChange={(e) => setOffStart(e.target.value)} /></div>
            <div className="grid gap-1"><Label>Fim</Label><Input type="datetime-local" value={offEnd} onChange={(e) => setOffEnd(e.target.value)} /></div>
            <div className="grid gap-1"><Label>Motivo (opcional)</Label><Input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} className="w-44" /></div>
            <Button size="sm" onClick={addTimeOff}>Adicionar folga</Button>
          </div>
        )}
      </section>
    </div>
  );
}
