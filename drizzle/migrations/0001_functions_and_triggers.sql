-- ===== Permission helpers (SECURITY DEFINER avoids RLS recursion) =====
CREATE OR REPLACE FUNCTION public.has_shop_role(_shop_id uuid, _roles public.shop_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_memberships m
    JOIN public.barbershops b ON b.id = m.barbershop_id
    WHERE m.barbershop_id = _shop_id AND m.user_id = auth.uid()
      AND m.is_active AND m.role = ANY(_roles)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_shop_member(_shop_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_shop_role(_shop_id, ARRAY['owner','admin','barber','receptionist']::public.shop_role[])
$$;

CREATE OR REPLACE FUNCTION public.is_shop_manager(_shop_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_shop_role(_shop_id, ARRAY['owner','admin']::public.shop_role[])
$$;

CREATE OR REPLACE FUNCTION public.is_shop_frontdesk(_shop_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_shop_role(_shop_id, ARRAY['owner','admin','receptionist']::public.shop_role[])
$$;

CREATE OR REPLACE FUNCTION public.is_barber_self(_barber_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.barbers br
    JOIN public.shop_memberships m ON m.barbershop_id = br.barbershop_id AND m.user_id = br.profile_id
    WHERE br.id = _barber_id AND br.profile_id = auth.uid() AND m.is_active AND m.role = 'barber'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_customer_self(_customer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.customers c WHERE c.id = _customer_id AND c.profile_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.barber_serves_customer(_customer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.customer_id = _customer_id AND public.is_barber_self(a.barber_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_profile(_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.shop_memberships me
      JOIN public.shop_memberships other ON other.barbershop_id = me.barbershop_id
      WHERE me.user_id = auth.uid() AND me.is_active AND other.user_id = _profile_id
    )
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.profile_id = _profile_id AND public.is_shop_frontdesk(c.barbershop_id)
    )
$$;

-- ===== Generic triggers =====
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.prevent_barbershop_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.barbershop_id IS DISTINCT FROM OLD.barbershop_id THEN
    RAISE EXCEPTION 'Não é permitido mover registros entre barbearias';
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','barbershops','shop_memberships','customers','barbers','services','working_hours','barber_time_off','appointments'] LOOP
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['shop_memberships','customers','barbers','services','barber_services','working_hours','barber_time_off','appointments'] LOOP
    EXECUTE format('CREATE TRIGGER trg_%1$s_lock_shop BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.prevent_barbershop_change()', t);
  END LOOP;
END $$;

-- ===== Profile on signup =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (NEW.id,
          left(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), 150),
          NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== Barbershop creation: creator becomes owner =====
CREATE OR REPLACE FUNCTION public.barbershop_before_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN NEW.created_by := auth.uid(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_barbershops_before_insert BEFORE INSERT ON public.barbershops
FOR EACH ROW EXECUTE FUNCTION public.barbershop_before_insert();

CREATE OR REPLACE FUNCTION public.barbershop_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.shop_memberships (barbershop_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_barbershops_after_insert AFTER INSERT ON public.barbershops
FOR EACH ROW EXECUTE FUNCTION public.barbershop_after_insert();

CREATE OR REPLACE FUNCTION public.barbershop_protect_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'O criador da barbearia não pode ser alterado';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_barbershops_protect BEFORE UPDATE ON public.barbershops
FOR EACH ROW EXECUTE FUNCTION public.barbershop_protect_columns();

-- ===== Membership protections =====
CREATE OR REPLACE FUNCTION public.membership_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Não é permitido trocar o usuário de um vínculo';
    END IF;
    IF auth.uid() IS NOT NULL AND OLD.user_id = auth.uid()
       AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.is_active IS DISTINCT FROM OLD.is_active) THEN
      RAISE EXCEPTION 'Você não pode alterar o seu próprio papel ou status';
    END IF;
  END IF;

  IF OLD.role = 'owner' AND OLD.is_active
     AND (TG_OP = 'DELETE' OR NEW.role <> 'owner' OR NOT NEW.is_active)
     AND EXISTS (SELECT 1 FROM public.barbershops WHERE id = OLD.barbershop_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.shop_memberships
       WHERE barbershop_id = OLD.barbershop_id AND role = 'owner' AND is_active AND id <> OLD.id
     ) THEN
    RAISE EXCEPTION 'A barbearia precisa ter pelo menos um proprietário ativo';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_memberships_guard BEFORE UPDATE OR DELETE ON public.shop_memberships
FOR EACH ROW EXECUTE FUNCTION public.membership_guard();

-- ===== Time off: record author =====
CREATE OR REPLACE FUNCTION public.time_off_before_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.created_by := COALESCE(auth.uid(), NEW.created_by); RETURN NEW; END $$;
CREATE TRIGGER trg_time_off_before_insert BEFORE INSERT ON public.barber_time_off
FOR EACH ROW EXECUTE FUNCTION public.time_off_before_insert();

-- ===== Customer self-service guard =====
CREATE OR REPLACE FUNCTION public.customer_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_shop_frontdesk(NEW.barbershop_id) THEN
    RETURN NEW;
  END IF;
  -- Non-staff (the customer themselves)
  IF TG_OP = 'INSERT' THEN
    IF NEW.profile_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Clientes só podem criar o próprio cadastro';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.barbershops WHERE id = NEW.barbershop_id AND is_active) THEN
      RAISE EXCEPTION 'Barbearia indisponível';
    END IF;
  ELSIF NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
    RAISE EXCEPTION 'Não é permitido alterar o vínculo do cadastro';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_customers_guard BEFORE INSERT OR UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.customer_guard();

-- ===== Appointment validation =====
CREATE OR REPLACE FUNCTION public.appointment_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tz text;
  v_frontdesk boolean;
  v_service public.services%ROWTYPE;
  v_local_start timestamp;
  v_local_end timestamp;
  v_needs_check boolean;
BEGIN
  SELECT timezone INTO v_tz FROM public.barbershops WHERE id = NEW.barbershop_id AND is_active;
  IF v_tz IS NULL THEN RAISE EXCEPTION 'Barbearia indisponível'; END IF;

  v_frontdesk := v_uid IS NULL OR public.is_shop_frontdesk(NEW.barbershop_id);

  IF TG_OP = 'INSERT' THEN
    SELECT * INTO v_service FROM public.services WHERE id = NEW.service_id AND barbershop_id = NEW.barbershop_id;
    IF NOT FOUND OR NOT v_service.is_active THEN RAISE EXCEPTION 'Serviço indisponível'; END IF;
    -- Snapshot price and duration at booking time
    IF NOT v_frontdesk OR NEW.price IS NULL THEN NEW.price := v_service.price; END IF;
    IF NOT v_frontdesk OR NEW.duration_minutes IS NULL THEN NEW.duration_minutes := v_service.duration_minutes; END IF;
    NEW.created_by := COALESCE(v_uid, NEW.created_by);
    IF NOT v_frontdesk THEN
      IF NOT public.is_customer_self(NEW.customer_id) THEN
        RAISE EXCEPTION 'Você só pode agendar para o seu próprio cadastro';
      END IF;
      NEW.status := 'scheduled';
      IF NEW.starts_at < now() THEN RAISE EXCEPTION 'Não é possível agendar no passado'; END IF;
    END IF;
  ELSE
    IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      RAISE EXCEPTION 'O autor do agendamento não pode ser alterado';
    END IF;
    IF NOT v_frontdesk THEN
      IF public.is_barber_self(OLD.barber_id) THEN
        -- Barber: may only change status and notes
        IF (NEW.customer_id, NEW.barber_id, NEW.service_id, NEW.starts_at, NEW.duration_minutes, NEW.price)
           IS DISTINCT FROM (OLD.customer_id, OLD.barber_id, OLD.service_id, OLD.starts_at, OLD.duration_minutes, OLD.price) THEN
          RAISE EXCEPTION 'Barbeiros só podem alterar o status e as observações do atendimento';
        END IF;
      ELSE
        -- Customer: may only cancel an upcoming appointment
        IF (NEW.customer_id, NEW.barber_id, NEW.service_id, NEW.starts_at, NEW.duration_minutes, NEW.price, NEW.notes)
           IS DISTINCT FROM (OLD.customer_id, OLD.barber_id, OLD.service_id, OLD.starts_at, OLD.duration_minutes, OLD.price, OLD.notes)
           OR NEW.status <> 'cancelled' OR OLD.status NOT IN ('scheduled','confirmed') THEN
          RAISE EXCEPTION 'Clientes só podem cancelar agendamentos futuros';
        END IF;
      END IF;
    END IF;
  END IF;

  NEW.ends_at := NEW.starts_at + make_interval(mins => NEW.duration_minutes);

  v_needs_check := NEW.status IN ('scheduled','confirmed') AND (
    TG_OP = 'INSERT'
    OR NEW.starts_at <> OLD.starts_at OR NEW.ends_at <> OLD.ends_at
    OR NEW.barber_id <> OLD.barber_id OR NEW.service_id <> OLD.service_id
    OR OLD.status NOT IN ('scheduled','confirmed'));

  IF v_needs_check THEN
    IF NOT EXISTS (SELECT 1 FROM public.barbers WHERE id = NEW.barber_id AND is_active) THEN
      RAISE EXCEPTION 'Barbeiro indisponível';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.barber_services WHERE barber_id = NEW.barber_id AND service_id = NEW.service_id) THEN
      RAISE EXCEPTION 'Este barbeiro não realiza o serviço escolhido';
    END IF;
    v_local_start := NEW.starts_at AT TIME ZONE v_tz;
    v_local_end := NEW.ends_at AT TIME ZONE v_tz;
    IF v_local_start::date <> v_local_end::date OR NOT EXISTS (
      SELECT 1 FROM public.working_hours w
      WHERE w.barber_id = NEW.barber_id
        AND w.weekday = extract(dow FROM v_local_start)
        AND w.start_time <= v_local_start::time
        AND w.end_time >= v_local_end::time
    ) THEN
      RAISE EXCEPTION 'Horário fora do expediente do barbeiro';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.barber_time_off t
      WHERE t.barber_id = NEW.barber_id
        AND tstzrange(t.starts_at, t.ends_at, '[)') && tstzrange(NEW.starts_at, NEW.ends_at, '[)')
    ) THEN
      RAISE EXCEPTION 'O barbeiro está indisponível neste horário';
    END IF;
  END IF;

  RETURN NEW;
END $$;
CREATE TRIGGER trg_appointments_guard BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.appointment_guard();

-- ===== Availability without exposing other customers =====
CREATE OR REPLACE FUNCTION public.get_barber_busy_slots(_barber_id uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE (starts_at timestamptz, ends_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
  IF _to <= _from OR _to - _from > interval '31 days' THEN
    RAISE EXCEPTION 'Intervalo inválido (máximo 31 dias)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.barbers br JOIN public.barbershops b ON b.id = br.barbershop_id
    WHERE br.id = _barber_id AND br.is_active AND b.is_active
  ) THEN
    RAISE EXCEPTION 'Barbeiro indisponível';
  END IF;
  RETURN QUERY
    SELECT a.starts_at, a.ends_at FROM public.appointments a
    WHERE a.barber_id = _barber_id AND a.status IN ('scheduled','confirmed')
      AND a.starts_at < _to AND a.ends_at > _from
    UNION ALL
    SELECT t.starts_at, t.ends_at FROM public.barber_time_off t
    WHERE t.barber_id = _barber_id AND t.starts_at < _to AND t.ends_at > _from
    ORDER BY 1;
END $$;

-- ===== Execute privileges =====
REVOKE EXECUTE ON FUNCTION
  public.set_updated_at(), public.prevent_barbershop_change(), public.handle_new_user(),
  public.barbershop_before_insert(), public.barbershop_after_insert(), public.barbershop_protect_columns(),
  public.membership_guard(), public.time_off_before_insert(), public.customer_guard(), public.appointment_guard()
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION
  public.has_shop_role(uuid, public.shop_role[]), public.is_shop_member(uuid), public.is_shop_manager(uuid),
  public.is_shop_frontdesk(uuid), public.is_barber_self(uuid), public.is_customer_self(uuid),
  public.barber_serves_customer(uuid), public.can_view_profile(uuid),
  public.get_barber_busy_slots(uuid, timestamptz, timestamptz)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.has_shop_role(uuid, public.shop_role[]), public.is_shop_member(uuid), public.is_shop_manager(uuid),
  public.is_shop_frontdesk(uuid), public.is_barber_self(uuid), public.is_customer_self(uuid),
  public.barber_serves_customer(uuid), public.can_view_profile(uuid),
  public.get_barber_busy_slots(uuid, timestamptz, timestamptz)
TO authenticated;