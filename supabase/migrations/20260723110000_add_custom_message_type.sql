-- Add 'custom' to message_type enum for owner-to-staff messages
ALTER TYPE public.message_type ADD VALUE IF NOT EXISTS 'custom';
