import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { ServiceForm } from "@/components/ServiceForm";
import { formatBRL, formatDuration } from "@/lib/service-rules";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

export const Route = createFileRoute("/_authenticated/servicos")({
  head: () => ({
    meta: [
      { title: "Serviços — BarberPro" },
      {
        name: "description",
        content: "Cadastre os serviços da sua barbearia com nome, preço e duração.",
      },
      { property: "og:title", content: "Serviços — BarberPro" },
      {
        property: "og:description",
        content: "Cadastre os serviços da sua barbearia com nome, preço e duração.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Servicos,
});

const ROLE_LABEL: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  barber: "Barbeiro",
  receptionist: "Recepcionista",
};

function Servicos() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [shopId, setShopId] = useState<string>("");
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ServiceRow | null>(null);
  const [deleting, setDeleting] = useState(false);

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
  const activeShop = shops.data?.find((m) => m.barbershop?.id === activeShopId);
  const canManage = activeShop?.role === "owner" || activeShop?.role === "admin";

  const services = useQuery({
    queryKey: ["services", activeShopId],
    enabled: Boolean(activeShopId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("barbershop_id", activeShopId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("services")
        .delete()
        .eq("id", pendingDelete.id)
        .eq("barbershop_id", activeShopId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["services", activeShopId] });
      setPendingDelete(null);
    } catch {
      // The row is still there; the dialog stays open so the user can retry.
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Link to="/painel" className="font-display text-xl font-bold">
          Barber<span className="text-accent">Pro</span>
        </Link>
        <Button variant="outline" size="sm" onClick={signOut}>
          Sair
        </Button>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link to="/painel" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar ao painel
        </Link>
        <h1 className="mt-2 font-display text-4xl font-bold">Serviços</h1>
        <p className="mt-2 text-muted-foreground">
          O que a sua barbearia oferece, com preço e duração de cada atendimento.
        </p>

        {shops.isLoading ? (
          <p className="mt-8 text-muted-foreground">Carregando...</p>
        ) : !shops.data?.length ? (
          <section className="mt-8 rounded-lg border border-border bg-card p-6">
            <p>Cadastre sua barbearia para começar a listar serviços.</p>
            <Button asChild className="mt-4">
              <Link to="/painel">Ir para o painel</Link>
            </Button>
          </section>
        ) : (
          <>
            {shops.data.length > 1 && (
              <div className="mt-8 max-w-xs">
                <Select value={activeShopId} onValueChange={setShopId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolher barbearia" />
                  </SelectTrigger>
                  <SelectContent>
                    {shops.data.map((m) => (
                      <SelectItem key={m.barbershop?.id} value={m.barbershop?.id ?? ""}>
                        {m.barbershop?.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <section className="mt-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-display text-2xl font-bold">
                  {shops.data.length === 1 ? shops.data[0]?.barbershop?.name : "Lista de serviços"}
                </h2>
                {canManage && !creating && !editing && (
                  <Button size="sm" onClick={() => setCreating(true)}>
                    Novo serviço
                  </Button>
                )}
              </div>

              {canManage && (creating || editing) && (
                <div className="mb-6 rounded-lg border border-border bg-card p-6">
                  <h3 className="mb-4 font-display text-xl font-bold">
                    {editing ? "Editar serviço" : "Novo serviço"}
                  </h3>
                  <ServiceForm
                    barbershopId={activeShopId}
                    {...(editing ? { service: editing } : {})}
                    onDone={() => {
                      setCreating(false);
                      setEditing(null);
                    }}
                  />
                </div>
              )}

              {!canManage && (
                <p className="mb-4 rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
                  Você está aqui como {ROLE_LABEL[activeShop?.role ?? ""]}. Só o proprietário ou
                  o administrador pode alterar os serviços.
                </p>
              )}

              {services.isLoading ? (
                <p className="text-muted-foreground">Carregando...</p>
              ) : services.isError ? (
                <p className="text-destructive">Não foi possível carregar os serviços.</p>
              ) : !services.data?.length ? (
                <p className="rounded-lg border border-dashed border-border p-6 text-muted-foreground">
                  Nenhum serviço cadastrado ainda.
                </p>
              ) : (
                <ul className="grid gap-3">
                  {services.data.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-5"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold">{s.name}</p>
                        {s.description && (
                          <p className="text-sm text-muted-foreground">{s.description}</p>
                        )}
                        <p className="mt-1 text-sm">
                          {formatBRL(s.price)} · {formatDuration(s.duration_minutes)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!s.is_active && (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                        {canManage && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditing(s);
                                setCreating(false);
                              }}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPendingDelete(s)}
                            >
                              Excluir
                            </Button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.name} vai sair da lista de serviços. Essa ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
