import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { CreateBarbershopForm } from "@/components/CreateBarbershopForm";
import { ROLE_LABEL, useActiveBarbershop } from "@/hooks/use-my-barbershops";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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

/** Código que o barbeiro repassa ao dono para ser ligado à ficha dele. */
function InviteCode({ userId }: { userId: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(userId);
      toast.success("Código copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o código e copie manualmente.");
    }
  }
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm">
      <span className="text-muted-foreground">É barbeiro? Envie este código de convite ao dono da barbearia:</span>
      <code className="rounded bg-secondary px-2 py-1 font-mono text-xs" data-testid="invite-code-value">{userId}</code>
      <Button size="sm" variant="ghost" onClick={copy} data-testid="invite-code-copy-button">Copiar</Button>
    </div>
  );
}

function Painel() {
  const { user } = Route.useRouteContext();
  const { shop: requestedShopId } = Route.useSearch();
  const name = (user.user_metadata?.["full_name"] as string | undefined) || user.email;

  const [creating, setCreating] = useState(false);
  const { shops, activeShopId, setActiveShopId, shopsQuery } = useActiveBarbershop(
    "/painel",
    user.id,
    requestedShopId,
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader shops={shops} activeShopId={activeShopId} onSelectShop={setActiveShopId} />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-4xl font-bold">Olá, {name}!</h1>
        <InviteCode userId={user.id} />
        {shopsQuery.isLoading ? (
          <p className="mt-6 text-muted-foreground">Carregando...</p>
        ) : shopsQuery.isError ? (
          <p className="mt-6 text-destructive">Não foi possível carregar suas barbearias.</p>
        ) : !shops.length || creating ? (
          <section className="mt-8 rounded-lg border border-border bg-card p-6 sm:p-8">
            <h2 className="font-display text-2xl font-bold">
              {shops.length ? "Nova barbearia" : "Vamos cadastrar sua barbearia"}
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
              {shops.map((m) => m.barbershop && (
                <li key={m.barbershop.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-5" data-testid="barbershop-card">
                  <div>
                    <p className="font-semibold">{m.barbershop.name}</p>
                    <p className="text-sm text-muted-foreground">{m.barbershop.address || m.barbershop.phone || "Sem endereço cadastrado"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                      {ROLE_LABEL[m.role]}
                    </span>
                    <Button asChild size="sm">
                      <Link to="/agenda" search={{ shop: m.barbershop.id }}>Agenda</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/servicos" search={{ shop: m.barbershop.id }}>Serviços</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/barbeiros" search={{ shop: m.barbershop.id }}>Barbeiros</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
