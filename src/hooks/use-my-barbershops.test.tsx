import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useSearch,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---- Supabase mock: registra cada consulta a shop_memberships ----
type Call = { table: string; eq: [string, unknown][]; order?: [string, unknown] };
const calls: Call[] = [];
let membershipsResult: unknown[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from(table: string) {
      const call: Call = { table, eq: [] };
      calls.push(call);
      const builder = {
        select: () => builder,
        eq: (col: string, val: unknown) => {
          call.eq.push([col, val]);
          return builder;
        },
        order: (col: string, opts: unknown) => {
          call.order = [col, opts];
          return Promise.resolve({ data: membershipsResult, error: null });
        },
      };
      return builder;
    },
  },
}));

import { parseShopSearch, useActiveBarbershop, type ShopScopedPath } from "./use-my-barbershops";

const SHOP_A = { id: "shop-a", name: "Navalha de Ouro", phone: "85 9999", address: "Rua A" };
const SHOP_B = { id: "shop-b", name: "Corte Fino", phone: null, address: null };
const FOREIGN = "shop-de-outro-dono";

function Probe({ path }: { path: ShopScopedPath }) {
  const search = useSearch({ strict: false }) as { shop?: string };
  const s = useActiveBarbershop(path, "user-1", search.shop);
  if (!s.shopsQuery.isSuccess) return <p>carregando</p>;
  return (
    <div>
      <span data-testid="active">{s.activeShopId}</span>
      <span data-testid="name">{s.activeShop?.name ?? ""}</span>
      <span data-testid="can-manage">{String(s.canManage)}</span>
    </div>
  );
}

function setup(initialUrl: string, queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  const root = createRootRoute({ component: () => <Outlet /> });
  const layout = createRoute({ getParentRoute: () => root, id: "_authenticated", validateSearch: parseShopSearch });
  const page = (path: ShopScopedPath) =>
    createRoute({ getParentRoute: () => layout, path, component: () => <Probe path={path} /> });
  const router = createRouter({
    routeTree: root.addChildren([layout.addChildren([page("/painel"), page("/servicos"), page("/barbeiros")])]),
    history: createMemoryHistory({ initialEntries: [initialUrl] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient };
}

beforeEach(() => {
  calls.length = 0;
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("parseShopSearch", () => {
  it("aceita só ?shop textual com tamanho sensato", () => {
    expect(parseShopSearch({ shop: "abc" })).toEqual({ shop: "abc" });
    expect(parseShopSearch({ shop: "" })).toEqual({});
    expect(parseShopSearch({ shop: 123 })).toEqual({});
    expect(parseShopSearch({ shop: "x".repeat(81) })).toEqual({});
    expect(parseShopSearch({})).toEqual({});
  });
});

describe("useActiveBarbershop", () => {
  it("usuário com uma barbearia: ela é a ativa, sem ?shop na URL", async () => {
    membershipsResult = [{ role: "owner", barbershop: SHOP_A }];
    const { router } = setup("/servicos");
    expect(await screen.findByTestId("active")).toHaveTextContent("shop-a");
    expect(screen.getByTestId("can-manage")).toHaveTextContent("true");
    expect(router.state.location.search).toEqual({});
  });

  it("consulta memberships do próprio usuário, ativas e ordenadas por created_at", async () => {
    membershipsResult = [{ role: "owner", barbershop: SHOP_A }];
    setup("/painel");
    await screen.findByTestId("active");
    const q = calls.filter((c) => c.table === "shop_memberships");
    expect(q).toHaveLength(1);
    expect(q[0]?.eq).toEqual([["user_id", "user-1"], ["is_active", true]]);
    expect(q[0]?.order).toEqual(["created_at", { ascending: true }]);
  });

  it("múltiplas barbearias: fallback determinístico é a primeira por created_at", async () => {
    membershipsResult = [
      { role: "admin", barbershop: SHOP_A },
      { role: "barber", barbershop: SHOP_B },
    ];
    setup("/servicos");
    expect(await screen.findByTestId("active")).toHaveTextContent("shop-a");
  });

  it("múltiplas barbearias: ?shop válido seleciona a loja e o papel dela", async () => {
    membershipsResult = [
      { role: "admin", barbershop: SHOP_A },
      { role: "barber", barbershop: SHOP_B },
    ];
    setup("/servicos?shop=shop-b");
    expect(await screen.findByTestId("active")).toHaveTextContent("shop-b");
    expect(screen.getByTestId("name")).toHaveTextContent("Corte Fino");
    // barbeiro na loja B não gerencia, mesmo sendo admin da loja A
    expect(screen.getByTestId("can-manage")).toHaveTextContent("false");
  });

  it("?shop de loja não autorizada é ignorado e a URL é normalizada", async () => {
    membershipsResult = [{ role: "owner", barbershop: SHOP_A }];
    const { router } = setup(`/servicos?shop=${FOREIGN}`);
    expect(await screen.findByTestId("active")).toHaveTextContent("shop-a");
    await waitFor(() => expect(router.state.location.search).toEqual({ shop: "shop-a" }));
    expect(router.state.location.pathname).toBe("/servicos");
  });

  it("?shop não autorizado sem nenhuma loja: limpa a URL e não ativa nada", async () => {
    membershipsResult = [];
    const { router } = setup(`/painel?shop=${FOREIGN}`);
    expect(await screen.findByTestId("active")).toHaveTextContent("");
    await waitFor(() => expect(router.state.location.search).toEqual({}));
  });

  it("navegação entre páginas mantém a loja e reaproveita o cache (uma só consulta)", async () => {
    membershipsResult = [
      { role: "owner", barbershop: SHOP_A },
      { role: "owner", barbershop: SHOP_B },
    ];
    const { router } = setup("/servicos?shop=shop-b");
    expect(await screen.findByTestId("active")).toHaveTextContent("shop-b");
    await router.navigate({ to: "/barbeiros", search: { shop: "shop-b" } });
    await waitFor(() => expect(router.state.location.pathname).toBe("/barbeiros"));
    expect(await screen.findByTestId("active")).toHaveTextContent("shop-b");
    await router.navigate({ to: "/painel", search: { shop: "shop-b" } });
    expect(await screen.findByTestId("active")).toHaveTextContent("shop-b");
    expect(calls.filter((c) => c.table === "shop_memberships")).toHaveLength(1);
  });

  it("cache padronizado: uma chave ['my-barbershops', userId] com o formato completo", async () => {
    membershipsResult = [{ role: "owner", barbershop: SHOP_A }];
    const { queryClient } = setup("/painel");
    await screen.findByTestId("active");
    expect(queryClient.getQueryData(["my-barbershops", "user-1"])).toEqual([
      { role: "owner", barbershop: { id: "shop-a", name: "Navalha de Ouro", phone: "85 9999", address: "Rua A" } },
    ]);
    const keys = queryClient.getQueryCache().getAll().map((q) => q.queryKey);
    expect(keys).toEqual([["my-barbershops", "user-1"]]);
  });
});
