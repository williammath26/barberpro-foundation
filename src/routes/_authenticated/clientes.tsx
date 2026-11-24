import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { CustomerHistory } from "@/components/customers/CustomerHistory";
import { matchesCustomerSearch } from "@/lib/customer-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — BarberPro" },
      { name: "description", content: "Cadastro e histórico dos clientes da sua barbearia." },
      { property: "og:title", content: "Clientes — BarberPro" },
      { property: "og:description", content: "Cadastro e histórico dos clientes da sua barbearia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Clientes,
});

function Clientes() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [shopId, setShopId] = useState("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const shops = useQuery({
    queryKey: ["my-barbershops", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_memberships")
        .select("role, barbershop:barbershops(id, name)")
        .eq("user_id", user.id)
        .eq("is_active", true);
      if (error) throw error;
      return data.filter((m) => m.barbershop);
    },
  });
  const activeShopId = shopId || shops.data?.[0]?.barbershop?.id || "";
  const role = shops.data?.find((m) => m.barbershop?.id === activeShopId)?.role;
  const canEdit = role === "owner" || role === "admin" || role === "receptionist";
  const canDelete = role === "owner" || role === "admin";

  const customers = useQuery({
    queryKey: ["customers", activeShopId],
    enabled: Boolean(activeShopId),
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").eq("barbershop_id", activeShopId).order("full_name");
      if (error) throw error;
      return data;
    },
  });
  const list = (customers.data ?? []).filter((c) => matchesCustomerSearch(c, search));

  async function remove(c: CustomerRow) {
    if (!confirm(`Excluir ${c.full_name}?`)) return;
    const { error } = await supabase.from("customers").delete().eq("id", c.id).eq("barbershop_id", activeShopId);
    if (error) { toast.error("Não foi possível excluir. Clientes com agendamentos não podem ser excluídos."); return; }
    toast.success("Cliente excluído.");
    queryClient.invalidateQueries({ queryKey: ["customers", activeShopId] });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <Link to="/painel" className="font-display text-xl font-bold">Barber<span className="text-accent">Pro</span></Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link to="/painel" className="text-sm text-muted-foreground hover:text-foreground">← Voltar ao painel</Link>
        <h1 className="mt-2 font-display text-4xl font-bold">Clientes</h1>
        <p className="mt-2 text-muted-foreground">Quem frequenta a sua barbearia e o histórico de cada um.</p>

        {shops.data && shops.data.length > 1 && (
          <div className="mt-6 max-w-xs">
            <Select value={activeShopId} onValueChange={setShopId}>
              <SelectTrigger><SelectValue placeholder="Escolher barbearia" /></SelectTrigger>
              <SelectContent>
                {shops.data.map((m) => <SelectItem key={m.barbershop?.id} value={m.barbershop?.id ?? ""}>{m.barbershop?.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <Input placeholder="Buscar por nome, telefone ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} />
          {canEdit && !creating && !editing && <Button onClick={() => setCreating(true)}>Novo cliente</Button>}
        </div>

        {(creating || editing) && activeShopId && (
          <div className="mt-6 rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 font-display text-xl font-bold">{editing ? "Editar cliente" : "Novo cliente"}</h2>
            <CustomerForm key={editing?.id ?? "new"} barbershopId={activeShopId} {...(editing ? { customer: editing } : {})} onDone={() => { setCreating(false); setEditing(null); }} />
          </div>
        )}

        {customers.isLoading || shops.isLoading ? (
          <p className="mt-6 text-muted-foreground">Carregando...</p>
        ) : customers.isError ? (
          <p className="mt-6 text-destructive">Não foi possível carregar os clientes.</p>
        ) : !list.length ? (
          <p className="mt-6 rounded-lg border border-dashed border-border p-6 text-muted-foreground">
            {search ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}
          </p>
        ) : (
          <ul className="mt-6 grid gap-3">
            {list.map((c) => (
              <li key={c.id} className="rounded-lg border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{c.full_name}</p>
                    <p className="text-sm text-muted-foreground">{[c.phone, c.email].filter(Boolean).join(" · ") || "Sem contato"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setOpenId(openId === c.id ? null : c.id)}>
                      {openId === c.id ? "Fechar" : "Histórico"}
                    </Button>
                    {canEdit && <Button size="sm" variant="outline" onClick={() => { setEditing(c); setCreating(false); }}>Editar</Button>}
                    {canDelete && <Button size="sm" variant="ghost" onClick={() => remove(c)}>Excluir</Button>}
                  </div>
                </div>
                {openId === c.id && <div className="mt-4"><CustomerHistory customerId={c.id} barbershopId={activeShopId} /></div>}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
