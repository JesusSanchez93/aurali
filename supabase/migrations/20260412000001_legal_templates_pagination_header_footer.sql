-- Add PaginationPlus-native header/footer fields to legal_templates.
-- These replace the block-node approach (DocumentHeaderExtension / DocumentFooterExtension)
-- with HTML strings that PaginationPlus renders as decorations on every page.

ALTER TABLE public.legal_templates
  ADD COLUMN IF NOT EXISTS header_left  text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS header_right text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS footer_left  text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS footer_right text NOT NULL DEFAULT '';
