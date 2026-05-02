-- ============================================
-- MIGRATION: profile_professional_card_location
-- Description: Add country and city of issuance for professional card
-- Date: 2026-05-02
-- ============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS professional_card_country text,
  ADD COLUMN IF NOT EXISTS professional_card_region text,
  ADD COLUMN IF NOT EXISTS professional_card_city text;
