import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { AppHeader } from "@/components/AppHeader";
import { BarberDetails } from "@/components/barbers/BarberDetails";
import { ROLE_LABEL, useActiveBarbershop } from "@/hooks/use-my-barbershops";
import { validateBarberName } from "@/lib/barber-rules";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

type Barber = Database["public"]["Tables"]["barbers"]["Row"];

export const Route = createFileRoute("/_authenticated/barbeiros")({
  head: () => ({
    meta: [
      { title: "Barbeiros e horários — BarberPro" },
      { name: "description", content: "Cadastre barbeiros, os serviços que fazem, expediente e folgas." },
      { property: "og:title", content: "Barbeiros e horários — BarberPro" },
      { property: "og:description", content: "Cadastre barbeiros, os serviços que fazem, expediente e folgas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Barbeiros,
});

function BarberForm({ shopId, barber, onDone }: { shopId: string; barber?: Barber; onDone: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(barber?.display_name ?? "");
  const [bio, setBio] = useState(barber?.bio ?? "");
  const [active, setActive] = useState(barber?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const err = validateBarberName(name);
    if (err) { toast.error(err); return; }
    setSaving(true);
    const values = { display_name: name.trim(), bio: bio.trim() || null, is_active: active };
    const { error } = barber
      ? await supabase.from("barbers").update(values).eq("id", barber.id).eq("barbershop_id", shopId)
      : await supabase.from("barbers").insert({ ...values, barbershop_id: shopId });
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar o barbeiro."); return; }
    await qc.invalidateQueries({ queryKey: ["barbers", shopId] });
    toast.success("Barbeiro salvo.");
    onDone();
  }
  return (
    <form onSubmit={save} className="grid gap-4">
      <div className="grid gap-1"><Label htmlFor="bname">Nome</Label><Input id="bname" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></div>
      <div className="grid gap-1"><Label htmlFor="bbio">Apresentação (opcional)</Label><Textarea id="bbio" value={bio} maxLength={500} onChange={(e) => setBio(e.target.value)} /></div>
      <label className="flex items-center gap-2 text-sm"><Switch checked={active} onCheckedChange={setActive} /> Ativo (aparece para agendamento)</label>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancelar</Button>
      </div>
    </form>
  );
}

function Barbeiros() {
  const { user } = Route.useRouteContext();
  const { shop: requestedShopId } = Route.useSearch();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Barber | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const { shops, activeShopId, activeShop, activeRole, canManage, setActiveShopId, shopsQuery } =
    useActiveBarbershop("/barbeiros", user.id, requestedShopId);

  // Trocar de barbearia (seletor ou URL) nunca deve carregar estado da loja anterior.
  useEffect(() => {
    setCreating(false);
    setEditing(null);
    setOpenId(null);
  }, [activeShopId]);

  const barbers = useQuery({
    queryKey: ["barbers", activeShopId],
    enabled: Boolean(activeShopId),
    queryFn: async () => {
      const { data, error } = await supabase.from("barbers").select("*").eq("barbershop_id", activeShopId).order("display_name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader shops={shops} activeShopId={activeShopId} onSelectShop={setActiveShopId} />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link
          to="/painel"
          search={activeShopId ? { shop: activeShopId } : {}}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Voltar ao painel
        </Link>
        <h1 className="mt-2 font-display text-4xl font-bold">Barbeiros e horários</h1>
        <p className="mt-2 text-muted-foreground">Quem trabalha, que serviços faz, expediente e folgas.</p>

        {shopsQuery.isLoading ? (
          <p className="mt-8 text-muted-foreground">Carregando...</p>
        ) : !shops.length ? (
          <section className="mt-8 rounded-lg border border-border bg-card p-6">
            <p>Cadastre sua barbearia primeiro.</p>
            <Button asChild className="mt-4"><Link to="/painel">Ir para o painel</Link></Button>
          </section>
        ) : (
          <section className="mt-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-bold">{activeShop?.name}</h2>
              {canManage && !creating && !editing && <Button size="sm" onClick={() => setCreating(true)} data-testid="new-barber-button">Novo barbeiro</Button>}
            </div>
            {!canManage && (
              <p className="mb-4 rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
                Você está aqui como {ROLE_LABEL[activeRole ?? ""]}. Só o proprietário ou o administrador pode alterar barbeiros e horários.
              </p>
            )}
            {canManage && (creating || editing) && (
              <div className="mb-6 rounded-lg border border-border bg-card p-6">
                <h3 className="mb-4 font-display text-xl font-bold">{editing ? "Editar barbeiro" : "Novo barbeiro"}</h3>
                <BarberForm key={`${activeShopId}-${editing?.id ?? "new"}`} shopId={activeShopId} {...(editing ? { barber: editing } : {})} onDone={() => { setCreating(false); setEditing(null); }} />
              </div>
            )}
            {barbers.isLoading ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : barbers.isError ? (
              <p className="text-destructive">Não foi possível carregar os barbeiros.</p>
            ) : !barbers.data?.length ? (
              <p className="rounded-lg border border-dashed border-border p-6 text-muted-foreground">Nenhum barbeiro cadastrado ainda.</p>
            ) : (
              <ul className="grid gap-3">
                {barbers.data.map((b) => (
                  <li key={b.id} className="rounded-lg border border-border bg-card p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{b.display_name}</p>
                        {b.bio && <p className="text-sm text-muted-foreground">{b.bio}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {!b.is_active && <Badge variant="secondary">Inativo</Badge>}
                        {canManage && <Button variant="outline" size="sm" onClick={() => { setEditing(b); setCreating(false); }}>Editar</Button>}
                        <Button size="sm" variant={openId === b.id ? "secondary" : "default"} onClick={() => setOpenId(openId === b.id ? null : b.id)}>
                          {openId === b.id ? "Fechar" : "Serviços e horários"}
                        </Button>
                      </div>
                    </div>
                    {openId === b.id && <BarberDetails barber={b} shopId={activeShopId} canManage={canManage} />}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
