import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
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

function Painel() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const name = (user.user_metadata?.full_name as string | undefined) || user.email;

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
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-4xl font-bold">Olá, {name}!</h1>
        <p className="mt-3 text-muted-foreground">Você está conectado. As funcionalidades da barbearia chegam em breve.</p>
      </main>
    </div>
  );
}
