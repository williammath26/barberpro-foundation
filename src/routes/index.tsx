import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BarberPro — Gestão de barbearias" },
      { name: "description", content: "BarberPro: plataforma SaaS de gestão para barbearias." },
      { property: "og:title", content: "BarberPro — Gestão de barbearias" },
      { property: "og:description", content: "Plataforma SaaS de gestão para barbearias." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="font-display text-5xl font-bold tracking-tight text-foreground">
          Barber<span className="text-accent">Pro</span>
        </h1>
        <p className="mt-3 text-muted-foreground">Gestão completa para a sua barbearia.</p>
        <Button asChild className="mt-8 h-11 px-8">
          <Link to="/auth">Entrar ou criar conta</Link>
        </Button>
      </div>
    </main>
  );
}
