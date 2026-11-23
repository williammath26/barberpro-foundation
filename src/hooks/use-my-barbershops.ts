import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ShopRole = Database["public"]["Enums"]["shop_role"];

export const ROLE_LABEL: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  barber: "Barbeiro",
  receptionist: "Recepcionista",
};

export type MyMembership = {
  role: ShopRole;
  barbershop: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
  };
};

/**
 * Fonte única da lista de barbearias do usuário.
 * Uma só queryFn/shape/chave de cache ("my-barbershops") para todas as páginas,
 * ordenada por created_at para dar fallback determinístico à loja ativa.
 */
export function useMyBarbershops(userId: string) {
  return useQuery({
    queryKey: ["my-barbershops", userId],
    // Memberships mudam raramente e têm invalidação explícita (criação de barbearia,
    // login/logout em __root). Sem isso, cada página montada refaria a consulta.
    // Nunca é base de autorização: a RLS continua validando cada operação.
    staleTime: 60_000,
    queryFn: async (): Promise<MyMembership[]> => {
      const { data, error } = await supabase
        .from("shop_memberships")
        .select("role, barbershop:barbershops(id, name, phone, address)")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Resolve a barbearia ativa compartilhada pelas páginas do painel via ?shop=<id>.
 *
 * Segurança: o parâmetro da URL é apenas seleção de contexto — a autorização real
 * permanece na RLS e no .eq("barbershop_id", ...) de cada operação. O ?shop só é
 * aceito se o usuário tiver membership ativa na loja informada; caso contrário, o
 * fallback determinístico (primeira loja por created_at) entra em vigor e a URL
 * é normalizada.
 */
/** Páginas do painel que compartilham a barbearia ativa. */
export type ShopScopedPath = "/painel" | "/servicos" | "/barbeiros";

export type ShopSearch = { shop?: string };

/** validateSearch do grupo _authenticated: aceita só ?shop textual e de tamanho sensato. */
export function parseShopSearch(search: Record<string, unknown>): ShopSearch {
  const raw = search["shop"];
  const shop = typeof raw === "string" && raw.length > 0 && raw.length <= 80 ? raw : undefined;
  return shop ? { shop } : {};
}

export function useActiveBarbershop(
  path: ShopScopedPath,
  userId: string,
  requestedShopId?: string,
) {
  const navigate = useNavigate();
  const shopsQuery = useMyBarbershops(userId);
  const shops = shopsQuery.data ?? [];

  const fallbackShopId = shops[0]?.barbershop.id ?? "";
  const isAuthorizedShop =
    typeof requestedShopId === "string" &&
    shops.some((m) => m.barbershop.id === requestedShopId);
  const activeShopId = isAuthorizedShop && requestedShopId ? requestedShopId : fallbackShopId;
  const activeMembership = shops.find((m) => m.barbershop.id === activeShopId) ?? null;
  const activeShop = activeMembership?.barbershop ?? null;
  const activeRole: ShopRole | null = activeMembership?.role ?? null;
  const canManage = activeRole === "owner" || activeRole === "admin";

  function setActiveShopId(shopId: string) {
    void navigate({ to: path, search: { shop: shopId }, replace: true });
  }

  // Normaliza a URL quando o ?shop não pertence ao usuário ou ficou obsoleto.
  useEffect(() => {
    if (!shopsQuery.isSuccess) return;
    if (!requestedShopId || requestedShopId === activeShopId) return;
    void navigate({
      to: path,
      search: activeShopId ? { shop: activeShopId } : {},
      replace: true,
    });
  }, [shopsQuery.isSuccess, requestedShopId, activeShopId, navigate, path]);

  return {
    shopsQuery,
    shops,
    activeShopId,
    activeShop,
    activeRole,
    canManage,
    setActiveShopId,
  };
}
