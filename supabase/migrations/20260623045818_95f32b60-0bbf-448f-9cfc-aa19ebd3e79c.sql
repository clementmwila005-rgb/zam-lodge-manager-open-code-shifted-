
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  department text NOT NULL CHECK (department IN ('bar','restaurant','accommodation','general')),
  category text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  payment_method text,
  note text,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  recorded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_business_date ON public.expenses(business_id, expense_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses tenant read" ON public.expenses
  FOR SELECT TO authenticated
  USING (public.has_business_access(business_id));

CREATE POLICY "expenses owner write" ON public.expenses
  FOR ALL TO authenticated
  USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
