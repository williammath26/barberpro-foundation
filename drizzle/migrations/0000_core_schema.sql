CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

CREATE TYPE public.shop_role AS ENUM ('owner','admin','barber','receptionist');
CREATE TYPE public.appointment_status AS ENUM ('scheduled','confirmed','completed','cancelled','no_show');

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_full_name_len CHECK (full_name IS NULL OR char_length(full_name) <= 150)
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- BARBERSHOPS
CREATE TABLE public.barbershops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 80),
  phone text,
  email text,
  address text,
  timezone text NOT NULL DEFAULT 'America/Fortaleza',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barbershops TO authenticated;
GRANT ALL ON public.barbershops TO service_role;
ALTER TABLE public.barbershops ENABLE ROW LEVEL SECURITY;

-- SHOP MEMBERSHIPS
CREATE TABLE public.shop_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.shop_role NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (barbershop_id, user_id)
);
CREATE INDEX shop_memberships_user_idx ON public.shop_memberships(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_memberships TO authenticated;
GRANT ALL ON public.shop_memberships TO service_role;
ALTER TABLE public.shop_memberships ENABLE ROW LEVEL SECURITY;

-- CUSTOMERS
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name text NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 1 AND 150),
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, barbershop_id),
  UNIQUE (barbershop_id, profile_id)
);
CREATE INDEX customers_profile_idx ON public.customers(profile_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- BARBERS
CREATE TABLE public.barbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 120),
  bio text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, barbershop_id),
  UNIQUE (barbershop_id, profile_id)
);
CREATE INDEX barbers_profile_idx ON public.barbers(profile_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barbers TO authenticated;
GRANT ALL ON public.barbers TO service_role;
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;

-- SERVICES
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  description text,
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 5 AND 480),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, barbershop_id)
);
CREATE INDEX services_shop_idx ON public.services(barbershop_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- BARBER_SERVICES
CREATE TABLE public.barber_services (
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  barber_id uuid NOT NULL,
  service_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (barber_id, service_id),
  FOREIGN KEY (barber_id, barbershop_id) REFERENCES public.barbers(id, barbershop_id) ON DELETE CASCADE,
  FOREIGN KEY (service_id, barbershop_id) REFERENCES public.services(id, barbershop_id) ON DELETE CASCADE
);
CREATE INDEX barber_services_service_idx ON public.barber_services(service_id);
CREATE INDEX barber_services_shop_idx ON public.barber_services(barbershop_id);
GRANT SELECT, INSERT, DELETE ON public.barber_services TO authenticated;
GRANT ALL ON public.barber_services TO service_role;
ALTER TABLE public.barber_services ENABLE ROW LEVEL SECURITY;

-- WORKING HOURS (local time of the barbershop timezone)
CREATE TABLE public.working_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  barber_id uuid NOT NULL,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  FOREIGN KEY (barber_id, barbershop_id) REFERENCES public.barbers(id, barbershop_id) ON DELETE CASCADE,
  CONSTRAINT working_hours_no_overlap EXCLUDE USING gist (
    barber_id WITH =, weekday WITH =,
    int4range((extract(epoch FROM start_time))::int, (extract(epoch FROM end_time))::int) WITH &&
  )
);
CREATE INDEX working_hours_shop_idx ON public.working_hours(barbershop_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.working_hours TO authenticated;
GRANT ALL ON public.working_hours TO service_role;
ALTER TABLE public.working_hours ENABLE ROW LEVEL SECURITY;

-- BARBER TIME OFF
CREATE TABLE public.barber_time_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  barber_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  FOREIGN KEY (barber_id, barbershop_id) REFERENCES public.barbers(id, barbershop_id) ON DELETE CASCADE
);
CREATE INDEX barber_time_off_range_idx ON public.barber_time_off USING gist (barber_id, tstzrange(starts_at, ends_at, '[)'));
CREATE INDEX barber_time_off_shop_idx ON public.barber_time_off(barbershop_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barber_time_off TO authenticated;
GRANT ALL ON public.barber_time_off TO service_role;
ALTER TABLE public.barber_time_off ENABLE ROW LEVEL SECURITY;

-- APPOINTMENTS
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  barber_id uuid NOT NULL,
  service_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 5 AND 480),
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  notes text CHECK (notes IS NULL OR char_length(notes) <= 1000),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  FOREIGN KEY (customer_id, barbershop_id) REFERENCES public.customers(id, barbershop_id) ON DELETE RESTRICT,
  FOREIGN KEY (barber_id, barbershop_id) REFERENCES public.barbers(id, barbershop_id) ON DELETE RESTRICT,
  FOREIGN KEY (service_id, barbershop_id) REFERENCES public.services(id, barbershop_id) ON DELETE RESTRICT,
  CONSTRAINT appointments_no_overlap EXCLUDE USING gist (
    barber_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status IN ('scheduled','confirmed'))
);
CREATE INDEX appointments_shop_start_idx ON public.appointments(barbershop_id, starts_at);
CREATE INDEX appointments_customer_idx ON public.appointments(customer_id);
CREATE INDEX appointments_service_idx ON public.appointments(service_id);
CREATE INDEX appointments_barber_start_idx ON public.appointments(barber_id, starts_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;