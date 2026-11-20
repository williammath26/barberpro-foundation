import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-panel p-12 text-brand-panel-foreground lg:flex">
        <div className="absolute inset-y-0 right-0 w-3 bg-brand-stripe opacity-90" aria-hidden />
        <Link to="/" className="font-display text-3xl font-bold tracking-tight">
          Barber<span className="text-accent">Pro</span>
        </Link>
        <div className="max-w-md">
          <p className="font-display text-5xl leading-tight">
            A cadeira cheia começa com uma agenda organizada.
          </p>
          <p className="mt-6 text-brand-panel-foreground/70">
            Gestão de equipe, clientes e horários para a sua barbearia.
          </p>
        </div>
        <p className="text-sm text-brand-panel-foreground/50">© BarberPro</p>
      </aside>
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-10 block font-display text-2xl font-bold lg:hidden">
            Barber<span className="text-accent">Pro</span>
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
