import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MyMembership } from "@/hooks/use-my-barbershops";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Cabeçalho compartilhado do painel com o indicador da barbearia ativa.
 * Com mais de uma barbearia, o indicador vira um seletor que atualiza ?shop= na URL.
 */
export function AppHeader({
  shops,
  activeShopId,
  onSelectShop,
}: {
  shops: MyMembership[];
  activeShopId: string;
  onSelectShop: (shopId: string) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeShop = shops.find((m) => m.barbershop?.id === activeShopId)?.barbershop ?? null;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
      <Link
        to="/painel"
        search={activeShopId ? { shop: activeShopId } : {}}
        className="font-display text-xl font-bold"
      >
        Barber<span className="text-accent">Pro</span>
      </Link>
      <div className="flex items-center gap-3">
        {activeShop && shops.length > 1 && (
          <Select value={activeShopId} onValueChange={onSelectShop}>
            <SelectTrigger
              className="w-56"
              aria-label="Barbearia ativa"
              data-testid="active-shop-switcher"
            >
              <SelectValue placeholder="Escolher barbearia" />
            </SelectTrigger>
            <SelectContent>
              {shops.map((m) => (
                <SelectItem key={m.barbershop?.id} value={m.barbershop?.id ?? ""}>
                  {m.barbershop?.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {activeShop && shops.length <= 1 && (
          <span
            className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-secondary-foreground"
            data-testid="active-shop-indicator"
          >
            {activeShop.name}
          </span>
        )}
        <Button variant="outline" size="sm" onClick={signOut} data-testid="sign-out-button">
          Sair
        </Button>
      </div>
    </header>
  );
}
