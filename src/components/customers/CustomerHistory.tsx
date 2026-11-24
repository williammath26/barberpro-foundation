import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/service-rules";

const STATUS: Record<string, string> = {
  scheduled: "Agendado", confirmed: "Confirmado", completed: "Concluído", cancelled: "Cancelado", no_show: "Não compareceu",
};

export function CustomerHistory({ customerId, barbershopId }: { customerId: string; barbershopId: string }) {
  const q = useQuery({
    queryKey: ["customer-history", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, starts_at, status, price, service:services(name), barber:barbers(display_name)")
        .eq("customer_id", customerId)
        .eq("barbershop_id", barbershopId)
        .order("starts_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Carregando histórico...</p>;
  if (q.isError) return <p className="text-sm text-destructive">Não foi possível carregar o histórico.</p>;
  if (!q.data?.length) return <p className="text-sm text-muted-foreground">Nenhum atendimento ainda.</p>;
  const done = q.data.filter((a) => a.status === "completed");
  const total = done.reduce((s, a) => s + Number(a.price), 0);
  return (
    <div className="grid gap-2">
      <p className="text-sm">{done.length} atendimento(s) concluído(s) · {formatBRL(total)} no total</p>
      <ul className="grid gap-1 text-sm">
        {q.data.map((a) => (
          <li key={a.id} className="flex flex-wrap justify-between gap-2 border-t border-border pt-1">
            <span>{new Date(a.starts_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · {a.service?.name} com {a.barber?.display_name}</span>
            <span className="text-muted-foreground">{STATUS[a.status]} · {formatBRL(Number(a.price))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
