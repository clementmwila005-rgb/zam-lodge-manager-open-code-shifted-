-- Add housekeeping role to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'housekeeping';

-- Add delivery fee amount to businesses (separate from service_fee_amount)
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS delivery_fee_amount numeric DEFAULT 0;
