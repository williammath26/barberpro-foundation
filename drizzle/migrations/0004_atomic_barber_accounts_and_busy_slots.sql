-- Atomic barber-account linking and membership-scoped availability.
-- All functions are callable only by authenticated users; manager/member checks
-- are performed inside SECURITY DEFINER functions, never trusted to the client.

CREATE OR REPLACE FUNCTION public.link_barber_account(
  _shop_id uuid,
  _barber_id uuid,
  _user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.shop_role;
  v_profile_exists boolean;
  v_current_profile uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_shop_manager(_shop_id) THEN
    RAISE EXCEPTION 'Permissão insuficiente para gerenciar a equipe';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id)
    INTO v_profile_exists;
  IF NOT v_profile_exists THEN
    RAISE EXCEPTION 'Conta não encontrada';
  END IF;

  SELECT profile_id INTO v_current_profile
  FROM public.barbers
  WHERE id = _barber_id AND barbershop_id = _shop_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Barbeiro não encontrado nesta barbearia';
  END IF;
  IF v_current_profile IS NOT NULL AND v_current_profile <> _user_id THEN
    RAISE EXCEPTION 'Este barbeiro já está vinculado a outra conta';
  END IF;

  SELECT role INTO v_role
  FROM public.shop_memberships
  WHERE barbershop_id = _shop_id AND user_id = _user_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_role <> 'barber' THEN
      RAISE EXCEPTION 'Essa conta já faz parte da equipe com outro papel';
    END IF;
    UPDATE public.shop_memberships
      SET is_active = true
      WHERE barbershop_id = _shop_id AND user_id = _user_id;
  ELSE
    INSERT INTO public.shop_memberships (barbershop_id, user_id, role, is_active)
      VALUES (_shop_id, _user_id, 'barber', true);
  END IF;

  UPDATE public.barbers
    SET profile_id = _user_id
    WHERE id = _barber_id AND barbershop_id = _shop_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unlink_barber_account(
  _shop_id uuid,
  _barber_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_shop_manager(_shop_id) THEN
    RAISE EXCEPTION 'Permissão insuficiente para gerenciar a equipe';
  END IF;

  SELECT profile_id INTO v_user_id
  FROM public.barbers
  WHERE id = _barber_id AND barbershop_id = _shop_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Barbeiro não encontrado nesta barbearia';
  END IF;
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.barbers
    SET profile_id = NULL
    WHERE id = _barber_id AND barbershop_id = _shop_id;

  -- Do not remove a membership if the same user is still linked to another
  -- barber record in this shop (defensive even though the unique constraint
  -- normally prevents that state).
  IF NOT EXISTS (
    SELECT 1 FROM public.barbers
    WHERE barbershop_id = _shop_id AND profile_id = v_user_id
  ) THEN
    DELETE FROM public.shop_memberships
    WHERE barbershop_id = _shop_id AND user_id = v_user_id AND role = 'barber';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_barber_busy_slots(
  _barber_id uuid,
  _from timestamptz,
  _to timestamptz
)
RETURNS TABLE (starts_at timestamptz, ends_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF _from IS NULL OR _to IS NULL OR _to <= _from OR _to - _from > interval '31 days' THEN
    RAISE EXCEPTION 'Intervalo inválido (máximo 31 dias)';
  END IF;

  SELECT br.barbershop_id INTO v_shop_id
  FROM public.barbers br
  JOIN public.barbershops b ON b.id = br.barbershop_id
  WHERE br.id = _barber_id AND br.is_active AND b.is_active;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Barbeiro indisponível';
  END IF;
  IF NOT public.is_shop_member(v_shop_id) THEN
    RAISE EXCEPTION 'Você não tem acesso à agenda desta barbearia';
  END IF;

  RETURN QUERY
    SELECT a.starts_at, a.ends_at
    FROM public.appointments a
    WHERE a.barber_id = _barber_id
      AND a.status IN ('scheduled','confirmed')
      AND a.starts_at < _to AND a.ends_at > _from
    UNION ALL
    SELECT t.starts_at, t.ends_at
    FROM public.barber_time_off t
    WHERE t.barber_id = _barber_id
      AND t.starts_at < _to AND t.ends_at > _from
    ORDER BY 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_barber_account(uuid, uuid, uuid),
  public.unlink_barber_account(uuid, uuid),
  public.get_barber_busy_slots(uuid, timestamptz, timestamptz)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.link_barber_account(uuid, uuid, uuid),
  public.unlink_barber_account(uuid, uuid),
  public.get_barber_busy_slots(uuid, timestamptz, timestamptz)
TO authenticated;
