
-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('super_admin','owner','receptionist','restaurant_staff','bar_staff');
CREATE TYPE public.subscription_plan AS ENUM ('starter','business','enterprise','trial');
CREATE TYPE public.subscription_status AS ENUM ('trial','active','expired','suspended');
CREATE TYPE public.room_status AS ENUM ('available','occupied','reserved','cleaning','maintenance');
CREATE TYPE public.reservation_status AS ENUM ('pending','confirmed','checked_in','checked_out','cancelled','no_show');
CREATE TYPE public.table_status AS ENUM ('available','occupied','reserved');
CREATE TYPE public.order_status AS ENUM ('new','preparing','ready','served','cancelled','paid');
CREATE TYPE public.order_type AS ENUM ('restaurant','bar');
CREATE TYPE public.payment_method AS ENUM ('cash','mobile_money','card','charge_to_room');
CREATE TYPE public.adjustment_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.shift_type AS ENUM ('reception','restaurant','bar');
CREATE TYPE public.shift_status AS ENUM ('open','closed');
CREATE TYPE public.folio_status AS ENUM ('open','closed');
CREATE TYPE public.product_category AS ENUM ('food','beverages','alcohol','cleaning','toiletries','laundry','maintenance','other');

-- ============================================================
-- BUSINESSES
-- ============================================================
CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  business_code text NOT NULL UNIQUE,
  owner_name text NOT NULL,
  phone text,
  email text,
  address text,
  room_count int NOT NULL DEFAULT 0,
  logo_url text,
  receipt_footer text,
  receipt_width text NOT NULL DEFAULT '80mm',
  service_fee_amount numeric(12,2) NOT NULL DEFAULT 50,
  accommodation_enabled boolean NOT NULL DEFAULT true,
  restaurant_enabled boolean NOT NULL DEFAULT true,
  bar_enabled boolean NOT NULL DEFAULT true,
  plan public.subscription_plan NOT NULL DEFAULT 'trial',
  subscription_status public.subscription_status NOT NULL DEFAULT 'trial',
  subscription_expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USER_ROLES (multi-tenant: roles are per business; super_admin has business_id NULL)
-- ============================================================
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, business_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES (staff & owner profile data; business_id binds them to a tenant)
-- ============================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  full_name text,
  username text,
  phone text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, username)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SECURITY DEFINER HELPERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
$$;

CREATE OR REPLACE FUNCTION public.current_business_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT business_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.has_business_access(_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND business_id = _business_id)
$$;

CREATE OR REPLACE FUNCTION public.is_business_owner(_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND business_id = _business_id AND role = 'owner'
  )
$$;

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_businesses_updated BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile when an auth user signs up via owner email registration.
-- Stores nothing tenant-specific yet; we set business_id explicitly in our register flow.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================
-- POLICIES: businesses, user_roles, profiles
-- ============================================================
CREATE POLICY "super_admin sees all businesses" ON public.businesses
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "users see their business" ON public.businesses
  FOR SELECT TO authenticated USING (public.has_business_access(id));
CREATE POLICY "owners update their business" ON public.businesses
  FOR UPDATE TO authenticated USING (public.is_business_owner(id)) WITH CHECK (public.is_business_owner(id));
CREATE POLICY "super_admin updates any business" ON public.businesses
  FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
-- Inserts go through server functions using service role; no insert policy for authenticated.

CREATE POLICY "users see their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()) OR public.is_business_owner(business_id));

CREATE POLICY "users see profiles in their business" ON public.profiles
  FOR SELECT TO authenticated USING (
    id = auth.uid()
    OR public.is_super_admin(auth.uid())
    OR (business_id IS NOT NULL AND public.has_business_access(business_id))
  );
CREATE POLICY "users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "owners update staff profiles in their business" ON public.profiles
  FOR UPDATE TO authenticated USING (business_id IS NOT NULL AND public.is_business_owner(business_id))
  WITH CHECK (business_id IS NOT NULL AND public.is_business_owner(business_id));

-- ============================================================
-- ROOMS
-- ============================================================
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  room_number text NOT NULL,
  room_type text NOT NULL DEFAULT 'Standard',
  daily_rate numeric(12,2) NOT NULL DEFAULT 0,
  description text,
  image_url text,
  status public.room_status NOT NULL DEFAULT 'available',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, room_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_rooms_updated BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "rooms tenant access" ON public.rooms FOR ALL TO authenticated
  USING (public.has_business_access(business_id)) WITH CHECK (public.has_business_access(business_id));

-- ============================================================
-- GUESTS
-- ============================================================
CREATE TABLE public.guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  nrc_passport text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guests TO authenticated;
GRANT ALL ON public.guests TO service_role;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guests tenant access" ON public.guests FOR ALL TO authenticated
  USING (public.has_business_access(business_id)) WITH CHECK (public.has_business_access(business_id));

-- ============================================================
-- RESERVATIONS
-- ============================================================
CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE RESTRICT,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  check_in_date date NOT NULL,
  check_out_date date NOT NULL,
  status public.reservation_status NOT NULL DEFAULT 'confirmed',
  daily_rate numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_reservations_updated BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "reservations tenant access" ON public.reservations FOR ALL TO authenticated
  USING (public.has_business_access(business_id)) WITH CHECK (public.has_business_access(business_id));

-- ============================================================
-- GUEST FOLIOS
-- ============================================================
CREATE TABLE public.folios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE RESTRICT,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  status public.folio_status NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.folios TO authenticated;
GRANT ALL ON public.folios TO service_role;
ALTER TABLE public.folios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "folios tenant access" ON public.folios FOR ALL TO authenticated
  USING (public.has_business_access(business_id)) WITH CHECK (public.has_business_access(business_id));

CREATE TABLE public.folio_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  folio_id uuid NOT NULL REFERENCES public.folios(id) ON DELETE CASCADE,
  description text NOT NULL,
  category text NOT NULL, -- room|restaurant|bar|service_fee|other
  amount numeric(12,2) NOT NULL,
  source_order_id uuid,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.folio_lines TO authenticated;
GRANT ALL ON public.folio_lines TO service_role;
ALTER TABLE public.folio_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "folio_lines tenant access" ON public.folio_lines FOR ALL TO authenticated
  USING (public.has_business_access(business_id)) WITH CHECK (public.has_business_access(business_id));

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  folio_id uuid REFERENCES public.folios(id) ON DELETE SET NULL,
  order_id uuid,
  amount numeric(12,2) NOT NULL,
  method public.payment_method NOT NULL,
  reference text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments tenant access" ON public.payments FOR ALL TO authenticated
  USING (public.has_business_access(business_id)) WITH CHECK (public.has_business_access(business_id));

-- ============================================================
-- RESTAURANT / BAR
-- ============================================================
CREATE TABLE public.restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  table_number text NOT NULL,
  capacity int NOT NULL DEFAULT 4,
  status public.table_status NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, table_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_tables TO authenticated;
GRANT ALL ON public.restaurant_tables TO service_role;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "restaurant_tables tenant access" ON public.restaurant_tables FOR ALL TO authenticated
  USING (public.has_business_access(business_id)) WITH CHECK (public.has_business_access(business_id));

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  order_type public.order_type NOT NULL,
  table_id uuid REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
  status public.order_status NOT NULL DEFAULT 'new',
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  service_fee numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  payment_method public.payment_method,
  charged_to_room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  charged_to_folio_id uuid REFERENCES public.folios(id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "orders tenant access" ON public.orders FOR ALL TO authenticated
  USING (public.has_business_access(business_id)) WITH CHECK (public.has_business_access(business_id));

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid,
  variant_id uuid,
  name text NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  line_total numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items tenant access" ON public.order_items FOR ALL TO authenticated
  USING (public.has_business_access(business_id)) WITH CHECK (public.has_business_access(business_id));

-- ============================================================
-- INVENTORY
-- ============================================================
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  category public.product_category NOT NULL DEFAULT 'other',
  image_url text,
  barcode text,
  sku text,
  cost_price numeric(12,2) NOT NULL DEFAULT 0,
  selling_price numeric(12,2) NOT NULL DEFAULT 0,
  stock_quantity numeric(12,2) NOT NULL DEFAULT 0,
  min_stock_level numeric(12,2) NOT NULL DEFAULT 0,
  has_variants boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sold_in_restaurant boolean NOT NULL DEFAULT true,
  sold_in_bar boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "products tenant access" ON public.products FOR ALL TO authenticated
  USING (public.has_business_access(business_id)) WITH CHECK (public.has_business_access(business_id));

CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  barcode text,
  cost_price numeric(12,2) NOT NULL DEFAULT 0,
  selling_price numeric(12,2) NOT NULL DEFAULT 0,
  stock_quantity numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_variants tenant access" ON public.product_variants FOR ALL TO authenticated
  USING (public.has_business_access(business_id)) WITH CHECK (public.has_business_access(business_id));

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  change numeric(12,2) NOT NULL,
  previous_qty numeric(12,2) NOT NULL,
  new_qty numeric(12,2) NOT NULL,
  reason text,
  reference text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_movements tenant access" ON public.stock_movements FOR ALL TO authenticated
  USING (public.has_business_access(business_id)) WITH CHECK (public.has_business_access(business_id));

CREATE TABLE public.stock_adjustment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE,
  requested_change numeric(12,2) NOT NULL,
  reason text NOT NULL,
  status public.adjustment_status NOT NULL DEFAULT 'pending',
  requested_by uuid REFERENCES auth.users(id),
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_adjustment_requests TO authenticated;
GRANT ALL ON public.stock_adjustment_requests TO service_role;
ALTER TABLE public.stock_adjustment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_adjustment_requests tenant access" ON public.stock_adjustment_requests FOR ALL TO authenticated
  USING (public.has_business_access(business_id)) WITH CHECK (public.has_business_access(business_id));

-- ============================================================
-- SHIFTS
-- ============================================================
CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shift_type public.shift_type NOT NULL,
  status public.shift_status NOT NULL DEFAULT 'open',
  opening_float numeric(12,2) NOT NULL DEFAULT 0,
  cash_total numeric(12,2),
  mobile_money_total numeric(12,2),
  card_total numeric(12,2),
  expected_total numeric(12,2),
  variance numeric(12,2),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  notes text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shifts tenant access" ON public.shifts FOR ALL TO authenticated
  USING (public.has_business_access(business_id)) WITH CHECK (public.has_business_access(business_id));

-- ============================================================
-- AUDIT LOG (append-only)
-- ============================================================
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text,
  entity_id uuid,
  before_value jsonb,
  after_value jsonb,
  device text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs tenant read" ON public.audit_logs FOR SELECT TO authenticated
  USING (business_id IS NULL AND public.is_super_admin(auth.uid())
         OR (business_id IS NOT NULL AND public.has_business_access(business_id)));
CREATE POLICY "audit_logs tenant insert" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (business_id IS NULL OR public.has_business_access(business_id));
-- No update/delete: immutable.

-- ============================================================
-- SUPER ADMIN SUPPORT ACCESS LOG
-- ============================================================
CREATE TABLE public.support_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  reason text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.support_access_log TO authenticated;
GRANT ALL ON public.support_access_log TO service_role;
ALTER TABLE public.support_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "support_access_log super_admin only" ON public.support_access_log FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_rooms_business ON public.rooms(business_id);
CREATE INDEX idx_reservations_business_dates ON public.reservations(business_id, check_in_date, check_out_date);
CREATE INDEX idx_orders_business_status ON public.orders(business_id, status);
CREATE INDEX idx_folio_lines_folio ON public.folio_lines(folio_id);
CREATE INDEX idx_audit_business_time ON public.audit_logs(business_id, created_at DESC);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
