-- Add workflow_guide_seen flag to profiles
-- Controls whether the post-onboarding setup guide modal has been shown.
-- Default FALSE so existing users also see it once on next login.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS workflow_guide_seen BOOLEAN NOT NULL DEFAULT FALSE;
