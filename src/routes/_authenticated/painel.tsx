import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CreateBarbershopForm } from "@/components/CreateBarbershopForm";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — BarberPro" },
      { name: "description", content: "Painel da sua barbearia no BarberPro." },
      { property: "og:title", content: "Painel — BarberPro" },
      { property: "og:description", content: "Painel da sua barbearia no BarberPro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Painel,
});

const ROLE_LABEL: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  barber: "Barbeiro",
  receptionist: "Recepcionista",
};

function Painel() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const name = (user.user_metadata?.["full_name"] as string | undefined) || user.email;

  const [creating, setCreating] = useState(false);
  const shops = useQuery({
    queryKey: ["my-barbershops", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_memberships")
        .select("role, barbershop:barbershops(id, name, phone, address)")
        .eq("user_id", user.id)
        .eq("is_active", true);
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

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="font-display text-xl font-bold">Barber<span className="text-accent">Pro</span></span>
        <Button variant="outline" size="sm" onClick={signOut}>Sair</Button>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-4xl font-bold">Olá, {name}!</h1>
        {shops.isLoading ? (
          <p className="mt-6 text-muted-foreground">Carregando...</p>
        ) : shops.isError ? (
          <p className="mt-6 text-destructive">Não foi possível carregar suas barbearias.</p>
        ) : !shops.data?.length || creating ? (
          <section className="mt-8 rounded-lg border border-border bg-card p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold">
              {shops.data?.length ? "Nova barbearia" : "Vamos cadastrar sua barbearia"}
            </h2>
            <p className="mt-2 mb-6 text-muted-foreground">
              Você poderá alterar esses dados depois. Quem cria a barbearia se torna o proprietário.
            </p>
            <CreateBarbershopForm onDone={() => setCreating(false)} />
            {creating && (
              <Button variant="ghost" className="mt-3 w-full" onClick={() => setCreating(false)}>Cancelar</Button>
            )}
          </section>
        ) : (
          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold">Suas barbearias</h2>
              <Button variant="outline" size="sm" onClick={() => setCreating(true)}>Nova barbearia</Button>
            </div>
            <ul className="grid gap-3">
              {shops.data.map((m) => m.barbershop && (
                <li key={m.barbershop.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-5">
                  <div>
                    <p className="font-semibold">{m.barbershop.name}</p>
                    <p className="text-sm text-muted-foreground">{m.barbershop.address || m.barbershop.phone || "Sem endereço cadastrado"}</p>
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                    {ROLE_LABEL[m.role]}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
