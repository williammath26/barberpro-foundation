import { createFileRoute } from "@tanstack/react-router";

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
        <h1 className="text-4xl font-bold tracking-tight text-foreground">BarberPro</h1>
        <p className="mt-2 text-muted-foreground">Infraestrutura pronta. Em construção.</p>
      </div>
    </main>
  );
}
