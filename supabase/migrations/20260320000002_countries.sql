-- =============================================================================
-- countries
-- =============================================================================

CREATE TABLE public.countries (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         JSON,
  iso2         VARCHAR,
  iso3         VARCHAR,
  iso_numeric  VARCHAR,
  phone_code   VARCHAR,
  currency_code VARCHAR,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "countries_select_authenticated"
  ON public.countries FOR SELECT TO authenticated USING (true);

CREATE POLICY "countries_select_anon"
  ON public.countries FOR SELECT TO anon USING (true);

GRANT ALL ON TABLE public.countries TO anon, authenticated, service_role;
