-- PROFILES
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (public.can_view_profile(id));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- BARBERSHOPS
CREATE POLICY "barbershops_select" ON public.barbershops FOR SELECT TO authenticated
  USING (is_active OR public.is_shop_member(id));
CREATE POLICY "barbershops_insert" ON public.barbershops FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "barbershops_update_managers" ON public.barbershops FOR UPDATE TO authenticated
  USING (public.is_shop_manager(id)) WITH CHECK (public.is_shop_manager(id));
CREATE POLICY "barbershops_delete_owner" ON public.barbershops FOR DELETE TO authenticated
  USING (public.has_shop_role(id, ARRAY['owner']::public.shop_role[]));

-- SHOP MEMBERSHIPS
CREATE POLICY "memberships_select" ON public.shop_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_shop_member(barbershop_id));
CREATE POLICY "memberships_insert" ON public.shop_memberships FOR INSERT TO authenticated
  WITH CHECK (
    public.has_shop_role(barbershop_id, ARRAY['owner']::public.shop_role[])
    OR (public.is_shop_manager(barbershop_id) AND role IN ('barber','receptionist'))
  );
CREATE POLICY "memberships_update" ON public.shop_memberships FOR UPDATE TO authenticated
  USING (
    public.has_shop_role(barbershop_id, ARRAY['owner']::public.shop_role[])
    OR (public.is_shop_manager(barbershop_id) AND role IN ('barber','receptionist'))
  )
  WITH CHECK (
    public.has_shop_role(barbershop_id, ARRAY['owner']::public.shop_role[])
    OR (public.is_shop_manager(barbershop_id) AND role IN ('barber','receptionist'))
  );
CREATE POLICY "memberships_delete" ON public.shop_memberships FOR DELETE TO authenticated
  USING (
    public.has_shop_role(barbershop_id, ARRAY['owner']::public.shop_role[])
    OR (public.is_shop_manager(barbershop_id) AND role IN ('barber','receptionist'))
    OR (user_id = auth.uid() AND role <> 'owner')
  );

-- CUSTOMERS
CREATE POLICY "customers_select" ON public.customers FOR SELECT TO authenticated
  USING (public.is_shop_frontdesk(barbershop_id) OR profile_id = auth.uid() OR public.barber_serves_customer(id));
CREATE POLICY "customers_insert" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_frontdesk(barbershop_id) OR profile_id = auth.uid());
CREATE POLICY "customers_update" ON public.customers FOR UPDATE TO authenticated
  USING (public.is_shop_frontdesk(barbershop_id) OR profile_id = auth.uid())
  WITH CHECK (public.is_shop_frontdesk(barbershop_id) OR profile_id = auth.uid());
CREATE POLICY "customers_delete" ON public.customers FOR DELETE TO authenticated
  USING (public.is_shop_manager(barbershop_id));

-- BARBERS
CREATE POLICY "barbers_select" ON public.barbers FOR SELECT TO authenticated
  USING (public.is_shop_member(barbershop_id)
    OR (is_active AND EXISTS (SELECT 1 FROM public.barbershops b WHERE b.id = barbershop_id AND b.is_active)));
CREATE POLICY "barbers_insert" ON public.barbers FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_manager(barbershop_id));
CREATE POLICY "barbers_update" ON public.barbers FOR UPDATE TO authenticated
  USING (public.is_shop_manager(barbershop_id)) WITH CHECK (public.is_shop_manager(barbershop_id));
CREATE POLICY "barbers_delete" ON public.barbers FOR DELETE TO authenticated
  USING (public.is_shop_manager(barbershop_id));

-- SERVICES
CREATE POLICY "services_select" ON public.services FOR SELECT TO authenticated
  USING (public.is_shop_member(barbershop_id)
    OR (is_active AND EXISTS (SELECT 1 FROM public.barbershops b WHERE b.id = barbershop_id AND b.is_active)));
CREATE POLICY "services_insert" ON public.services FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_manager(barbershop_id));
CREATE POLICY "services_update" ON public.services FOR UPDATE TO authenticated
  USING (public.is_shop_manager(barbershop_id)) WITH CHECK (public.is_shop_manager(barbershop_id));
CREATE POLICY "services_delete" ON public.services FOR DELETE TO authenticated
  USING (public.is_shop_manager(barbershop_id));

-- BARBER SERVICES
CREATE POLICY "barber_services_select" ON public.barber_services FOR SELECT TO authenticated
  USING (public.is_shop_member(barbershop_id)
    OR EXISTS (SELECT 1 FROM public.barbershops b WHERE b.id = barbershop_id AND b.is_active));
CREATE POLICY "barber_services_insert" ON public.barber_services FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_manager(barbershop_id));
CREATE POLICY "barber_services_delete" ON public.barber_services FOR DELETE TO authenticated
  USING (public.is_shop_manager(barbershop_id));

-- WORKING HOURS
CREATE POLICY "working_hours_select" ON public.working_hours FOR SELECT TO authenticated
  USING (public.is_shop_member(barbershop_id)
    OR EXISTS (SELECT 1 FROM public.barbershops b WHERE b.id = barbershop_id AND b.is_active));
CREATE POLICY "working_hours_insert" ON public.working_hours FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_manager(barbershop_id));
CREATE POLICY "working_hours_update" ON public.working_hours FOR UPDATE TO authenticated
  USING (public.is_shop_manager(barbershop_id)) WITH CHECK (public.is_shop_manager(barbershop_id));
CREATE POLICY "working_hours_delete" ON public.working_hours FOR DELETE TO authenticated
  USING (public.is_shop_manager(barbershop_id));

-- BARBER TIME OFF (details visible to staff only; customers use get_barber_busy_slots)
CREATE POLICY "time_off_select" ON public.barber_time_off FOR SELECT TO authenticated
  USING (public.is_shop_frontdesk(barbershop_id) OR public.is_barber_self(barber_id));
CREATE POLICY "time_off_insert" ON public.barber_time_off FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_manager(barbershop_id) OR public.is_barber_self(barber_id));
CREATE POLICY "time_off_update" ON public.barber_time_off FOR UPDATE TO authenticated
  USING (public.is_shop_manager(barbershop_id) OR public.is_barber_self(barber_id))
  WITH CHECK (public.is_shop_manager(barbershop_id) OR public.is_barber_self(barber_id));
CREATE POLICY "time_off_delete" ON public.barber_time_off FOR DELETE TO authenticated
  USING (public.is_shop_manager(barbershop_id) OR public.is_barber_self(barber_id));

-- APPOINTMENTS
CREATE POLICY "appointments_select" ON public.appointments FOR SELECT TO authenticated
  USING (public.is_shop_frontdesk(barbershop_id) OR public.is_barber_self(barber_id) OR public.is_customer_self(customer_id));
CREATE POLICY "appointments_insert" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_frontdesk(barbershop_id) OR public.is_customer_self(customer_id));
CREATE POLICY "appointments_update" ON public.appointments FOR UPDATE TO authenticated
  USING (public.is_shop_frontdesk(barbershop_id) OR public.is_barber_self(barber_id) OR public.is_customer_self(customer_id))
  WITH CHECK (public.is_shop_frontdesk(barbershop_id) OR public.is_barber_self(barber_id) OR public.is_customer_self(customer_id));
CREATE POLICY "appointments_delete" ON public.appointments FOR DELETE TO authenticated
  USING (public.is_shop_manager(barbershop_id));