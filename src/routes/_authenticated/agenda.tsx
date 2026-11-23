import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { useActiveBarbershop } from "@/hooks/use-my-barbershops";
import { computeFreeSlots, describeAppointmentError, STATUS_LABEL } from "@/lib/agenda-rules";
import { formatBRL } from "@/lib/service-rules";
import { formatInZone, todayInZone, weekdayOf, zonedDayRange } from "@/lib/timezone";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["appointment_status"];
const NEW_CUSTOMER = "__novo__";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — BarberPro" },
      { name: "description", content: "Agendamentos do dia da sua barbearia, sem horários duplicados." },
      { property: "og:title", content: "Agenda — BarberPro" },
      { property: "og:description", content: "Agendamentos do dia da sua barbearia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Agenda,
});

function shiftDay(ymd: string, delta: number) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function Agenda() {
  const { user } = Route.useRouteContext();
  const { shop: requestedShopId } = Route.useSearch();
  const qc = useQueryClient();
  const { shops, activeShopId, activeShop, activeRole, setActiveShopId, shopsQuery } =
    useActiveBarbershop("/agenda", user.id, requestedShopId);
  const tz = activeShop?.timezone ?? "America/Fortaleza";
  const isFrontdesk = activeRole === "owner" || activeRole === "admin" || activeRole === "receptionist";

  const [day, setDay] = useState(() => todayInZone(tz));
  const [creating, setCreating] = useState(false);
  useEffect(() => { setCreating(false); setDay(todayInZone(tz)); }, [activeShopId, tz]);
  const { fromIso, toIso } = zonedDayRange(day, tz);

  const barbers = useQuery({
    queryKey: ["barbers", activeShopId],
    enabled: Boolean(activeShopId),
    queryFn: async () => {
      const { data, error } = await supabase.from("barbers").select("*").eq("barbershop_id", activeShopId).order("display_name");
      if (error) throw error;
      return data;
    },
  });
  const myBarber = barbers.data?.find((b) => b.profile_id === user.id) ?? null;

  const appointments = useQuery({
    queryKey: ["appointments", activeShopId, day],
    enabled: Boolean(activeShopId && fromIso),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, starts_at, ends_at, status, price, barber_id, customer:customers(full_name, phone), barber:barbers(display_name), service:services(name)")
        .eq("barbershop_id", activeShopId)
        .gte("starts_at", fromIso)
        .lt("starts_at", toIso)
        .order("starts_at");
      if (error) throw error;
      return data;
    },
  });

  async function setStatus(id: string, status: Status) {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id).eq("barbershop_id", activeShopId);
    if (error) { toast.error(describeAppointmentError(error)); return; }
    toast.success(`Agendamento ${STATUS_LABEL[status]?.toLowerCase()}.`);
    await qc.invalidateQueries({ queryKey: ["appointments", activeShopId] });
    await qc.invalidateQueries({ queryKey: ["busy-slots"] });
  }

  const fmtTime = (iso: string) => formatInZone(iso, tz, { hour: "2-digit", minute: "2-digit" });
  const dayLabel = formatInZone(`${day}T15:00:00Z`, "UTC", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader shops={shops} activeShopId={activeShopId} onSelectShop={setActiveShopId} />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link to="/painel" search={activeShopId ? { shop: activeShopId } : {}} className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar ao painel
        </Link>
        <h1 className="mt-2 font-display text-4xl font-bold">Agenda</h1>
        <p className="mt-2 text-muted-foreground">Atendimentos do dia no horário da barbearia ({tz}).</p>

        {shopsQuery.isLoading ? (
          <p className="mt-8 text-muted-foreground">Carregando...</p>
        ) : !shops.length ? (
          <section className="mt-8 rounded-lg border border-border bg-card p-6">
            <p>Cadastre sua barbearia primeiro.</p>
            <Button asChild className="mt-4"><Link to="/painel">Ir para o painel</Link></Button>
          </section>
        ) : (
          <section className="mt-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setDay(shiftDay(day, -1))} data-testid="agenda-prev-day-button">‹</Button>
                <Input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className="w-40" data-testid="agenda-date-input" />
                <Button variant="outline" size="sm" onClick={() => setDay(shiftDay(day, 1))} data-testid="agenda-next-day-button">›</Button>
                <Button variant="ghost" size="sm" onClick={() => setDay(todayInZone(tz))} data-testid="agenda-today-button">Hoje</Button>
              </div>
              {isFrontdesk && !creating && (
                <Button size="sm" onClick={() => setCreating(true)} data-testid="new-appointment-button">Novo agendamento</Button>
              )}
            </div>
            <p className="mb-4 font-semibold capitalize" data-testid="agenda-day-label">{dayLabel}</p>

            {activeRole === "barber" && !myBarber && barbers.isSuccess && (
              <p className="mb-4 rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground" data-testid="agenda-barber-not-linked">
                Sua conta ainda não está ligada a um barbeiro desta loja. Envie seu código de convite ao dono.
              </p>
            )}
            {activeRole === "barber" && myBarber && (
              <p className="mb-4 text-sm text-muted-foreground" data-testid="agenda-barber-own-note">Você vê apenas os seus atendimentos, {myBarber.display_name}.</p>
            )}

            {isFrontdesk && creating && (
              <AppointmentForm
                key={`${activeShopId}-${day}`}
                shopId={activeShopId}
                day={day}
                tz={tz}
                barbers={(barbers.data ?? []).filter((b) => b.is_active)}
                onDone={() => setCreating(false)}
              />
            )}

            {appointments.isLoading ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : appointments.isError ? (
              <p className="text-destructive">Não foi possível carregar a agenda.</p>
            ) : !appointments.data?.length ? (
              <p className="rounded-lg border border-dashed border-border p-6 text-muted-foreground" data-testid="agenda-empty">Nenhum agendamento neste dia.</p>
            ) : (
              <ul className="grid gap-3">
                {appointments.data.map((a) => {
                  const open = a.status === "scheduled" || a.status === "confirmed";
                  return (
                    <li key={a.id} className="rounded-lg border border-border bg-card p-5" data-testid="appointment-item">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold">{fmtTime(a.starts_at)} – {fmtTime(a.ends_at)} · {a.customer?.full_name ?? "Cliente"}</p>
                          <p className="text-sm text-muted-foreground">
                            {a.service?.name} com {a.barber?.display_name} · {formatBRL(a.price)}
                            {a.customer?.phone ? ` · ${a.customer.phone}` : ""}
                          </p>
                        </div>
                        <Badge variant={open ? "default" : "secondary"} data-testid="appointment-status">{STATUS_LABEL[a.status]}</Badge>
                      </div>
                      {open && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {a.status === "scheduled" && <Button size="sm" variant="outline" onClick={() => setStatus(a.id, "confirmed")}>Confirmar</Button>}
                          <Button size="sm" variant="outline" onClick={() => setStatus(a.id, "completed")}>Concluir</Button>
                          <Button size="sm" variant="ghost" onClick={() => setStatus(a.id, "no_show")}>Faltou</Button>
                          <Button size="sm" variant="ghost" onClick={() => setStatus(a.id, "cancelled")} data-testid="appointment-cancel-button">Cancelar</Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function AppointmentForm({ shopId, day, tz, barbers, onDone }: {
  shopId: string; day: string; tz: string;
  barbers: Database["public"]["Tables"]["barbers"]["Row"][];
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [barberId, setBarberId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [slot, setSlot] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const { fromIso, toIso } = zonedDayRange(day, tz);

  const services = useQuery({
    queryKey: ["services", shopId],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").eq("barbershop_id", shopId).order("name");
      if (error) throw error;
      return data;
    },
  });
  const barberServices = useQuery({
    queryKey: ["agenda-barber-services", shopId, barberId],
    enabled: Boolean(barberId),
    queryFn: async () => {
      const { data, error } = await supabase.from("barber_services").select("service_id").eq("barbershop_id", shopId).eq("barber_id", barberId);
      if (error) throw error;
      return data.map((d) => d.service_id);
    },
  });
  const hours = useQuery({
    queryKey: ["working-hours", shopId, barberId],
    enabled: Boolean(barberId),
    queryFn: async () => {
      const { data, error } = await supabase.from("working_hours").select("*").eq("barber_id", barberId).eq("barbershop_id", shopId).order("weekday").order("start_time");
      if (error) throw error;
      return data;
    },
  });
  const busy = useQuery({
    queryKey: ["busy-slots", barberId, day],
    enabled: Boolean(barberId && fromIso),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_barber_busy_slots", { _barber_id: barberId, _from: fromIso, _to: toIso });
      if (error) throw error;
      return data;
    },
  });
  const customers = useQuery({
    queryKey: ["customers", shopId],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, full_name, phone").eq("barbershop_id", shopId).order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const offered = (services.data ?? []).filter((s) => s.is_active && barberServices.data?.includes(s.id));
  const service = offered.find((s) => s.id === serviceId);
  const slots = useMemo(() => {
    if (!service || !hours.data || !busy.data) return [];
    const windows = hours.data.filter((h) => h.weekday === weekdayOf(day));
    return computeFreeSlots({ ymd: day, timeZone: tz, windows, durationMin: service.duration_minutes, busy: busy.data });
  }, [service, hours.data, busy.data, day, tz]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!barberId || !service || !slot) { toast.error("Escolha barbeiro, serviço e horário."); return; }
    if (!customerId || (customerId === NEW_CUSTOMER && !newName.trim())) { toast.error("Informe o cliente."); return; }
    setSaving(true);
    try {
      if (customerId === NEW_CUSTOMER) {
        const { error } = await supabase.rpc("create_appointment_with_new_customer", {
          _shop_id: shopId,
          _barber_id: barberId,
          _service_id: service.id,
          _starts_at: slot,
          _customer_name: newName.trim(),
          _customer_phone: newPhone.trim() || null,
        });
        if (error) {
          toast.error(describeAppointmentError(error));
          await qc.invalidateQueries({ queryKey: ["busy-slots", barberId, day] });
          setSlot("");
          return;
        }
        await qc.invalidateQueries({ queryKey: ["customers", shopId] });
      } else {
        const ends = new Date(Date.parse(slot) + service.duration_minutes * 60_000).toISOString();
        const { error } = await supabase.from("appointments").insert({
          barbershop_id: shopId, customer_id: customerId, barber_id: barberId, service_id: service.id,
          starts_at: slot, ends_at: ends, duration_minutes: service.duration_minutes, price: service.price,
        });
        if (error) {
          toast.error(describeAppointmentError(error));
          await qc.invalidateQueries({ queryKey: ["busy-slots", barberId, day] });
          setSlot("");
          return;
        }
      }
      toast.success("Agendamento criado.");
      await qc.invalidateQueries({ queryKey: ["appointments", shopId] });
      await qc.invalidateQueries({ queryKey: ["busy-slots", barberId, day] });
      onDone();
    } catch {
      toast.error("Não foi possível salvar o agendamento. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mb-6 grid gap-4 rounded-lg border border-border bg-card p-6" data-testid="appointment-form">
      <h3 className="font-display text-xl font-bold">Novo agendamento</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label>Barbeiro</Label>
          <Select value={barberId} onValueChange={(v) => { setBarberId(v); setServiceId(""); setSlot(""); }}>
            <SelectTrigger data-testid="appointment-barber-select"><SelectValue placeholder="Escolher barbeiro" /></SelectTrigger>
            <SelectContent>{barbers.map((b) => <SelectItem key={b.id} value={b.id}>{b.display_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label>Serviço</Label>
          <Select value={serviceId} onValueChange={(v) => { setServiceId(v); setSlot(""); }} disabled={!barberId}>
            <SelectTrigger data-testid="appointment-service-select"><SelectValue placeholder={barberId && !offered.length ? "Barbeiro sem serviços" : "Escolher serviço"} /></SelectTrigger>
            <SelectContent>{offered.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · {formatBRL(s.price)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      {service && (
        <div className="grid gap-1">
          <Label>Horário livre</Label>
          {busy.isLoading || hours.isLoading ? (
            <p className="text-sm text-muted-foreground">Calculando horários...</p>
          ) : !slots.length ? (
            <p className="text-sm text-muted-foreground" data-testid="appointment-no-slots">Sem horários livres neste dia (fora do expediente, folga ou agenda cheia).</p>
          ) : (
            <div className="flex flex-wrap gap-2" data-testid="appointment-slots">
              {slots.map((s) => (
                <Button key={s.startIso} type="button" size="sm" variant={slot === s.startIso ? "default" : "outline"} onClick={() => setSlot(s.startIso)} data-testid="appointment-slot-button">
                  {s.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="grid gap-1">
        <Label>Cliente</Label>
        <Select value={customerId} onValueChange={setCustomerId}>
          <SelectTrigger data-testid="appointment-customer-select"><SelectValue placeholder="Escolher cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NEW_CUSTOMER}>+ Novo cliente</SelectItem>
            {(customers.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}{c.phone ? ` · ${c.phone}` : ""}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {customerId === NEW_CUSTOMER && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1"><Label htmlFor="new-customer-name">Nome do cliente</Label><Input id="new-customer-name" maxLength={150} value={newName} onChange={(e) => setNewName(e.target.value)} data-testid="new-customer-name-input" /></div>
          <div className="grid gap-1"><Label htmlFor="new-customer-phone">Telefone (opcional)</Label><Input id="new-customer-phone" maxLength={30} value={newPhone} onChange={(e) => setNewPhone(e.target.value)} data-testid="new-customer-phone-input" /></div>
        </div>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving} data-testid="appointment-save-button">{saving ? "Salvando..." : "Agendar"}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancelar</Button>
      </div>
    </form>
  );
}
