import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { validateCustomer } from "@/lib/customer-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];

export function CustomerForm({ barbershopId, customer, onDone }: { barbershopId: string; customer?: CustomerRow; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [full_name, setName] = useState(customer?.full_name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateCustomer({ full_name, phone, email });
    if (err) { toast.error(err); return; }
    setSaving(true);
    const values = { full_name: full_name.trim(), phone: phone.trim() || null, email: email.trim() || null };
    const { error } = customer
      ? await supabase.from("customers").update(values).eq("id", customer.id).eq("barbershop_id", barbershopId)
      : await supabase.from("customers").insert({ ...values, barbershop_id: barbershopId });
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar o cliente."); return; }
    toast.success(customer ? "Cliente atualizado." : "Cliente cadastrado.");
    await queryClient.invalidateQueries({ queryKey: ["customers", barbershopId] });
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="c-name">Nome</Label>
        <Input id="c-name" value={full_name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="c-phone">Telefone</Label>
          <Input id="c-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(85) 99999-0000" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="c-email">E-mail</Label>
          <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancelar</Button>
      </div>
    </form>
  );
}
