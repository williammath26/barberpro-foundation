import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Barber = Database["public"]["Tables"]["barbers"]["Row"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Vincula e desvincula contas por funções transacionais no banco. */
export function BarberAccount({ barber, shopId, canManage }: { barber: Barber; shopId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["barbers", shopId] });

  async function link() {
    const userId = code.trim();
    if (!UUID_RE.test(userId)) {
      toast.error("Código inválido. Peça ao barbeiro o código que aparece no painel dele.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc("link_barber_account", {
        _shop_id: shopId,
        _barber_id: barber.id,
        _user_id: userId,
      });
      if (error) {
        if (error.message.includes("Conta não encontrada")) {
          toast.error("Código não encontrado. Confira se o barbeiro já criou a conta.");
        } else if (error.message.includes("outro papel")) {
          toast.error("Essa conta já faz parte da equipe com outro papel.");
        } else if (error.code === "23505") {
          toast.error("Essa conta já está ligada a outro barbeiro desta loja.");
        } else {
          throw error;
        }
        return;
      }
      toast.success("Conta ligada. O barbeiro já vê a própria agenda ao entrar.");
      setCode("");
      await refresh();
    } catch {
      toast.error("Não foi possível ligar a conta. Verifique suas permissões e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    if (!barber.profile_id) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("unlink_barber_account", {
        _shop_id: shopId,
        _barber_id: barber.id,
      });
      if (error) throw error;
      toast.success("Conta desvinculada.");
      await refresh();
    } catch {
      toast.error("Não foi possível desvincular a conta. Verifique suas permissões e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-testid="barber-account-section">
      <h4 className="font-semibold">Conta do barbeiro</h4>
      {barber.profile_id ? (
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full bg-secondary px-3 py-1 font-semibold" data-testid="barber-account-linked">Conta ligada</span>
          {canManage && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={unlink} data-testid="barber-account-unlink-button">Desvincular</Button>
          )}
        </div>
      ) : canManage ? (
        <div className="mt-2 grid gap-2">
          <p className="text-sm text-muted-foreground">
            Peça ao barbeiro para criar uma conta no BarberPro e enviar o código de convite que aparece no painel dele.
          </p>
          <div className="flex flex-wrap gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código de convite" className="w-80" data-testid="barber-invite-code-input" />
            <Button size="sm" disabled={busy || !code.trim()} onClick={link} data-testid="barber-invite-link-button">
              {busy ? "Ligando..." : "Ligar conta"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">Sem conta ligada.</p>
      )}
    </section>
  );
}
