-- Add professional_card_number column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS professional_card_number TEXT;
