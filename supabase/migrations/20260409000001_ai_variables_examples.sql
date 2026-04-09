-- Add examples column to ai_variables for few-shot prompting
ALTER TABLE public.ai_variables
  ADD COLUMN IF NOT EXISTS examples text[] DEFAULT '{}';
