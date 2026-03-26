-- =============================================================================
-- catalog_banks + catalog_documents (global, managed by SUPERADMIN)
-- =============================================================================

CREATE TABLE public.catalog_banks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  code       TEXT        NOT NULL,
  slug       TEXT        NOT NULL,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT catalog_banks_code_unique UNIQUE (code),
  CONSTRAINT catalog_banks_slug_unique UNIQUE (slug)
);

CREATE TABLE public.catalog_documents (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT        NOT NULL,
  name       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT catalog_documents_slug_unique UNIQUE (slug)
);

ALTER TABLE public.catalog_banks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_banks_select"
  ON public.catalog_banks FOR SELECT TO authenticated USING (true);

CREATE POLICY "catalog_banks_superadmin_write"
  ON public.catalog_banks FOR ALL TO authenticated
  USING (is_superadmin()) WITH CHECK (is_superadmin());

CREATE POLICY "catalog_documents_select"
  ON public.catalog_documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "catalog_documents_superadmin_write"
  ON public.catalog_documents FOR ALL TO authenticated
  USING (is_superadmin()) WITH CHECK (is_superadmin());

GRANT ALL ON TABLE public.catalog_banks     TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.catalog_documents TO anon, authenticated, service_role;

-- Seed
INSERT INTO public.catalog_banks (name, code, slug) VALUES
  ('Bancolombia',          'BANCOLOMBIA',         'bancolombia'),
  ('Banco de Bogotá',      'BANCO_BOGOTA',         'banco-bogota'),
  ('Davivienda',           'DAVIVIENDA',           'davivienda'),
  ('BBVA Colombia',        'BBVA_CO',              'bbva-colombia'),
  ('Banco Occidente',      'BANCO_OCCIDENTE',      'banco-occidente'),
  ('Scotiabank Colpatría', 'SCOTIABANK_COLPATRIA', 'scotiabank-colpatria'),
  ('Banco Popular',        'BANCO_POPULAR',        'banco-popular'),
  ('Banco Agrario',        'BANCO_AGRARIO',        'banco-agrario'),
  ('Itaú',                 'ITAU',                 'itau'),
  ('GNB Sudameris',        'GNB_SUDAMERIS',        'gnb-sudameris'),
  ('Nequi',                'NEQUI',                'nequi'),
  ('Daviplata',            'DAVIPLATA',            'daviplata'),
  ('Lulo Bank',            'LULO_BANK',            'lulo-bank'),
  ('Nubank',               'NUBANK',               'nubank'),
  ('Banco Caja Social',    'BANCO_CAJA_SOCIAL',    'banco-caja-social')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.catalog_documents (slug, name) VALUES
  ('CC',  '{"es": "Cédula de ciudadanía",            "en": "National ID"}'),
  ('CE',  '{"es": "Cédula de extranjería",           "en": "Foreign ID"}'),
  ('PP',  '{"es": "Pasaporte",                       "en": "Passport"}'),
  ('TI',  '{"es": "Tarjeta de identidad",            "en": "Identity Card"}'),
  ('NIT', '{"es": "NIT",                             "en": "Tax ID"}'),
  ('PEP', '{"es": "Permiso especial de permanencia", "en": "Special Permanence Permit"}')
ON CONFLICT (slug) DO NOTHING;
