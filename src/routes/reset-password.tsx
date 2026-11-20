import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Criar nova senha — BarberPro" },
      { name: "description", content: "Defina uma nova senha para sua conta BarberPro." },
      { property: "og:title", content: "Criar nova senha — BarberPro" },
      { property: "og:description", content: "Defina uma nova senha para sua conta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("A senha precisa ter pelo menos 8 caracteres.");
    if (password !== confirm) return toast.error("As senhas não coincidem.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error("Link inválido ou expirado. Solicite um novo.");
    toast.success("Senha atualizada!");
    navigate({ to: "/painel", replace: true });
  }

  return (
    <AuthShell>
      <h1 className="font-display text-3xl font-bold">Criar nova senha</h1>
      <p className="mt-2 text-muted-foreground">Escolha uma senha com pelo menos 8 caracteres.</p>
      <form onSubmit={onSubmit} className="mt-8 grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="password">Nova senha</Label>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirm">Confirmar senha</Label>
          <Input id="confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </div>
        <Button type="submit" className="mt-2 h-11 w-full" disabled={loading}>
          {loading ? "Salvando..." : "Salvar nova senha"}
        </Button>
      </form>
    </AuthShell>
  );
}
