-- ============================================================
-- MIGRATION: legal_process_banks_products
-- Description: A client can now report more than one financial
--   product affected (savings account, credit card, debit card),
--   each with its own last-4-digits. Adds an additive `products`
--   jsonb column: [{ "type": "savings_account"|"credit_card"|
--   "debit_card", "last_4_digits": "1234" }, ...]. The existing
--   `last_4_digits` column is kept (not dropped) for backward
--   compatibility with the dashboard detail view and the
--   BANKING.LAST_4_DIGITS document template variable — it now
--   stores a human-readable joined summary of all products.
-- Date: 2026-08-23
-- ============================================================

ALTER TABLE public.legal_process_banks
  ADD COLUMN IF NOT EXISTS products jsonb NOT NULL DEFAULT '[]'::jsonb;
