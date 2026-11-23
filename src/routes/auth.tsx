import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar ou criar conta — BarberPro" },
      { name: "description", content: "Acesse o BarberPro ou crie sua conta gratuitamente." },
      { property: "og:title", content: "Entrar ou criar conta — BarberPro" },
      { property: "og:description", content: "Acesse o BarberPro ou crie sua conta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function GoogleLogo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
  );
}

function translate(msg: string) {
  if (/invalid login/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(msg)) return "Confirme seu e-mail antes de entrar.";
  if (/already registered/i.test(msg)) return "Este e-mail já tem uma conta. Faça login.";
  if (/password/i.test(msg) && /(weak|pwned|short|least)/i.test(msg)) return "Escolha uma senha mais forte (mínimo 8 caracteres).";
  return "Não foi possível concluir. Tente novamente.";
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  // Antes da hidratação o form não tem handler: um envio cairia num GET nativo
  // e recarregaria a página apagando o que foi digitado. Bloqueamos o envio até
  // hidratar e recuperamos o que o usuário já digitou no DOM.
  const [hydrated, setHydrated] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (nameRef.current?.value) setName(nameRef.current.value);
    if (emailRef.current?.value) setEmail(emailRef.current.value);
    if (passwordRef.current?.value) setPassword(passwordRef.current.value);
    setHydrated(true);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/painel", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/painel", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        if (password.length < 8) {
          toast.error("A senha precisa ter pelo menos 8 caracteres.");
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/painel", data: { full_name: name.trim() } },
        });
        if (error) throw error;
        setSent("Enviamos um link de confirmação para " + email + ". Abra-o para ativar sua conta.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        setSent("Se houver uma conta com " + email + ", você receberá um link para criar uma nova senha.");
      }
    } catch (err) {
      toast.error(translate(err instanceof Error ? err.message : ""));
    } finally {
      setLoading(false);
    }
  }

  async function social(provider: "google" | "lovable") {
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/auth" });
    if (result.error) toast.error("Não foi possível entrar. Tente novamente.");
  }

  const titles: Record<Mode, [string, string]> = {
    signin: ["Bem-vindo de volta", "Entre para acessar sua barbearia."],
    signup: ["Crie sua conta", "Comece a organizar sua barbearia hoje."],
    forgot: ["Esqueceu a senha?", "Enviaremos um link para você criar outra."],
  };

  if (sent) {
    return (
      <AuthShell>
        <h1 className="font-display text-3xl font-bold">Verifique seu e-mail</h1>
        <p className="mt-3 text-muted-foreground">{sent}</p>
        <Button variant="outline" className="mt-8 w-full" onClick={() => { setSent(null); setMode("signin"); }}>
          Voltar para o login
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="font-display text-3xl font-bold">{titles[mode][0]}</h1>
      <p className="mt-2 text-muted-foreground">{titles[mode][1]}</p>

      {mode !== "forgot" && (
        <>
          <div className="mt-8 grid gap-3">
            <Button type="button" variant="outline" className="h-11 w-full" onClick={() => social("google")}>
              <GoogleLogo /> Continuar com Google
            </Button>
            <Button type="button" variant="outline" className="h-11 w-full" onClick={() => social("lovable")}>
              <LovableMark /> Continuar com Lovable
            </Button>
          </div>
          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> ou com e-mail <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form method="post" onSubmit={onSubmit} className={mode === "forgot" ? "mt-8 grid gap-4" : "grid gap-4"} data-testid="auth-form">
        {mode === "signup" && (
          <div className="grid gap-2">
            <Label htmlFor="name">Nome completo</Label>
            <Input ref={nameRef} id="name" required maxLength={150} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
        )}
        <div className="grid gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input ref={emailRef} id="email" type="email" required data-testid="auth-email-input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        {mode !== "forgot" && (
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              {mode === "signin" && (
                <button type="button" className="text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => setMode("forgot")}>
                  Esqueci a senha
                </button>
              )}
            </div>
            <Input ref={passwordRef} id="password" type="password" required data-testid="auth-password-input" minLength={mode === "signup" ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
          </div>
        )}
        <Button type="submit" className="mt-2 h-11 w-full" disabled={loading || !hydrated} data-testid="auth-submit-button">
          {!hydrated ? "Carregando..." : loading ? "Aguarde..." : mode === "signin" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "signin" ? "Ainda não tem conta? " : "Já tem conta? "}
        <button type="button" className="font-semibold text-foreground underline-offset-4 hover:underline" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "Criar conta" : "Entrar"}
        </button>
      </p>
    </AuthShell>
  );
}
