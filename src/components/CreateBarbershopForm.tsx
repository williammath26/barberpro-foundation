import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/slug";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateBarbershopForm({ onDone }: { onDone?: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const base = slugify(name);
    if (name.trim().length < 2 || !base) {
      toast.error("Informe um nome válido para a barbearia.");
      return;
    }
    setLoading(true);
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const slug = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
        const { error } = await supabase.from("barbershops").insert({
          name: name.trim(),
          slug,
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
        });
        if (!error) {
          toast.success("Barbearia criada! Você é o proprietário.");
          await queryClient.invalidateQueries({ queryKey: ["my-barbershops"] });
          onDone?.();
          return;
        }
        if (error.code !== "23505") throw error;
      }
      throw new Error("slug");
    } catch {
      toast.error("Não foi possível criar a barbearia. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="shop-name">Nome da barbearia *</Label>
        <Input id="shop-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Navalha de Ouro" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="shop-phone">Telefone / WhatsApp</Label>
          <Input id="shop-phone" type="tel" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="shop-email">E-mail da barbearia</Label>
          <Input id="shop-email" type="email" maxLength={150} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="shop-address">Endereço</Label>
        <Input id="shop-address" maxLength={250} value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <Button type="submit" className="mt-2 h-11" disabled={loading}>
        {loading ? "Criando..." : "Criar barbearia"}
      </Button>
    </form>
  );
}
