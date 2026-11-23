import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { parseShopSearch } from "@/hooks/use-my-barbershops";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  // Barbearia ativa compartilhada por todo o painel via ?shop=<id>.
  // O valor é só seleção de contexto: useActiveBarbershop confere a membership e a RLS autoriza.
  validateSearch: parseShopSearch,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
