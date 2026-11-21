import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  formatDuration,
  parseMoney,
  validateServiceDraft,
  type ServiceDraft,
  type ServiceErrors,
} from "@/lib/service-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type ServiceRow = Database["public"]["Tables"]["services"]["Row"];

const EMPTY: ServiceDraft = {
  name: "",
  price: "",
  durationMinutes: "",
  description: "",
  isActive: true,
};

function fromRow(row: ServiceRow): ServiceDraft {
  return {
    name: row.name,
    price: String(row.price),
    durationMinutes: String(row.duration_minutes),
    description: row.description ?? "",
    isActive: row.is_active,
  };
}

export function ServiceForm({
  barbershopId,
  service,
  onDone,
}: {
  barbershopId: string;
  service?: ServiceRow;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ServiceDraft>(service ? fromRow(service) : EMPTY);
  const [errors, setErrors] = useState<ServiceErrors>({});
  const [loading, setLoading] = useState(false);

  function set<K extends keyof ServiceDraft>(key: K, value: ServiceDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validateServiceDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const price = parseMoney(draft.price);
    if (price === null) return;

    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      price,
      duration_minutes: Number(draft.durationMinutes.trim()),
      is_active: draft.isActive,
    };

    setLoading(true);
    try {
      if (service) {
        const { error } = await supabase
          .from("services")
          .update(payload)
          .eq("id", service.id)
          .eq("barbershop_id", barbershopId);
        if (error) throw error;
        toast.success("Serviço atualizado.");
      } else {
        const { error } = await supabase
          .from("services")
          .insert({ ...payload, barbershop_id: barbershopId });
        if (error) throw error;
        toast.success("Serviço criado.");
      }
      await queryClient.invalidateQueries({ queryKey: ["services", barbershopId] });
      onDone();
    } catch {
      toast.error("Não foi possível salvar o serviço.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="service-name">Nome do serviço *</Label>
        <Input
          id="service-name"
          required
          maxLength={120}
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Ex.: Corte de cabelo"
          aria-invalid={errors.name ? true : undefined}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="service-price">Preço (R$) *</Label>
          <Input
            id="service-price"
            inputMode="decimal"
            required
            value={draft.price}
            onChange={(e) => set("price", e.target.value)}
            placeholder="45,00"
            aria-invalid={errors.price ? true : undefined}
          />
          {errors.price && <p className="text-sm text-destructive">{errors.price}</p>}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="service-duration">Duração em minutos *</Label>
          <Input
            id="service-duration"
            inputMode="numeric"
            required
            value={draft.durationMinutes}
            onChange={(e) => set("durationMinutes", e.target.value)}
            placeholder="45"
            aria-invalid={errors.durationMinutes ? true : undefined}
          />
          {errors.durationMinutes && (
            <p className="text-sm text-destructive">{errors.durationMinutes}</p>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="service-description">Descrição</Label>
        <Textarea
          id="service-description"
          rows={3}
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Opcional"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
        <div>
          <Label htmlFor="service-active" className="cursor-pointer">
            Serviço ativo
          </Label>
          <p className="text-sm text-muted-foreground">
            Só serviços ativos entram na página de agendamento.
          </p>
        </div>
        <Switch
          id="service-active"
          checked={draft.isActive}
          onCheckedChange={(checked) => set("isActive", checked)}
        />
      </div>

      {service && (
        <p className="text-sm text-muted-foreground">
          Duração cadastrada: {formatDuration(service.duration_minutes)}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" className="h-11 flex-1" disabled={loading}>
          {loading ? "Salvando..." : service ? "Salvar alterações" : "Criar serviço"}
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
