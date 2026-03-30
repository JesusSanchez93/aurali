-- =============================================================================
-- Seed: Superadmin user
-- Email:    jdavidsanchez1993@gmail.com
-- Password: aJdsan123.*
-- =============================================================================

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Skip if already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'jdavidsanchez1993@gmail.com') THEN
    RAISE NOTICE 'Superadmin already exists — skipping.';
    RETURN;
  END IF;

  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    'jdavidsanchez1993@gmail.com',
    crypt('aJdsan123.*', gen_salt('bf')),
    now(),
    now(),
    now(),
    '', '', '', ''
  );

  -- The handle_new_user trigger creates the profile automatically.
  -- Promote to SUPERADMIN and fill profile data.
  UPDATE public.profiles
  SET
    system_role       = 'SUPERADMIN',
    firstname         = 'Jesus',
    lastname          = 'Sanchez',
    phone             = '+573042455392',
    onboarding_status = 'completed'
  WHERE id = v_user_id;

  RAISE NOTICE 'Superadmin created: %', v_user_id;
END $$;

-- =============================================================================
-- Seed: Default workflow template — Fraudes Financieros
-- =============================================================================

DO $$
DECLARE
  v_template_id UUID := 'a91887dd-edbb-4e75-aa76-217977848177';
BEGIN
  IF EXISTS (SELECT 1 FROM public.workflow_templates WHERE id = v_template_id) THEN
    RAISE NOTICE 'Default workflow template already exists — skipping.';
    RETURN;
  END IF;

  -- ── Template ───────────────────────────────────────────────────────────────
  INSERT INTO public.workflow_templates (id, organization_id, name, description, is_default)
  VALUES (
    v_template_id,
    NULL,
    'Fraudes Financieros',
    'Flujo estándar: captación del cliente, recopilación de datos, revisión del abogado, generación y envío de documentos.',
    true
  );

  -- ── Nodes (ordered top → bottom by position_y) ────────────────────────────
  INSERT INTO public.workflow_nodes (template_id, node_id, type, title, position_x, position_y, config) VALUES

    -- 1. Start
    (v_template_id, 'node-start', 'start', 'Inicio', 540, -168, '{}'::jsonb),

    -- 2. Set status → draft
    (v_template_id, 'node-status-draft', 'status_update', 'Crear proceso', 797, -167,
      '{"new_status": "draft"}'::jsonb),

    -- 3. Send form email to client
    (v_template_id, 'node-send-form-email', 'send_email', 'Enviar formulario al cliente', 529, 97,
      '{
        "to": "{{client.email}}",
        "subject": "Complete su información — {{process.id}}",
        "email_template": "client_form_email",
        "body": {
          "type": "doc",
          "content": [
            {"type": "paragraph", "content": [{"text": "Estimado/a {{client.first_name}},", "type": "text"}]},
            {"type": "paragraph"},
            {"type": "paragraph", "content": [{"text": "Hemos iniciado su proceso legal. Por favor complete el formulario en el siguiente enlace:", "type": "text"}]},
            {"type": "paragraph"},
            {"type": "paragraph", "content": [{"text": "{{form_url}}", "type": "text"}]},
            {"type": "paragraph"},
            {"type": "paragraph", "content": [{"text": "Este enlace es válido por 72 horas.", "type": "text"}]}
          ]
        }
      }'::jsonb),

    -- 4. Client form
    (v_template_id, 'node-client-form', 'client_form', 'Datos del cliente', 530, 232,
      '{
        "title": "Información personal",
        "description": "Por favor complete sus datos personales para continuar con el proceso.",
        "fields": [
          {"name": "first_name",       "type": "text",   "label": "Nombres",               "required": true},
          {"name": "last_name",        "type": "text",   "label": "Apellidos",              "required": true},
          {"name": "document_type",    "type": "select", "label": "Tipo de documento",      "required": true,  "options": ["CC","CE","NIT","PP","TE"]},
          {"name": "document_number",  "type": "text",   "label": "Número de documento",    "required": true},
          {"name": "address",          "type": "text",   "label": "Dirección",              "required": false},
          {"name": "phone",            "type": "text",   "label": "Teléfono",               "required": true},
          {"name": "email",            "type": "email",  "label": "Correo electrónico",     "required": true}
        ]
      }'::jsonb),

    -- 5. Set status → completed
    (v_template_id, 'node-status-completed', 'status_update', 'Datos recibidos', 841, 233,
      '{"new_status": "completed"}'::jsonb),

    -- 6. Notify lawyer
    (v_template_id, 'node-notify-lawyer', 'notify_lawyer', 'Notificar al abogado', 541, 524,
      '{
        "recipients": "lawyer",
        "message": "El cliente {{client.first_name}} {{client.last_name}} completó el formulario del proceso {{process.id}}.\n\nPor favor revise los datos y apruebe para continuar."
      }'::jsonb),

    -- 7. Manual review (lawyer)
    (v_template_id, 'node-manual-review', 'manual_action', 'Revisión del abogado', 541, 656,
      '{
        "assignee": "lawyer",
        "instructions": "1. Verificar identidad del cliente.\n2. Confirmar datos de contacto.\n3. Aprobar para proceder con la generación de documentos."
      }'::jsonb),

    -- 8. Set status → approved
    (v_template_id, 'node-status-approved', 'status_update', 'Proceso aprobado', 817, 657,
      '{"new_status": "approved"}'::jsonb),

    -- 9. Generate documents
    (v_template_id, 'node-generate-doc', 'generate_document', 'Generar documentos', 540, 932,
      '{
        "template_ids": [],
        "document_name": "Contrato_{{client.first_name}}_{{client.last_name}}"
      }'::jsonb),

    -- 10. Notify lawyer after doc generation (fan-out branch)
    (v_template_id, 'notify_lawyer-1774677841928', 'notify_lawyer', 'Notificar Abogado', 278.554684205135, 1084.22220739703,
      '{"recipients": "lawyer", "message": ""}'::jsonb),

    -- 11. Send documents to client
    (v_template_id, 'node-send-documents', 'send_email', 'Enviar documentos al cliente', 523, 1082,
      '{
        "to": "{{client.email}}",
        "subject": "Sus documentos legales están listos",
        "attach_enabled": true,
        "attach_document_template_ids": [],
        "body": {
          "type": "doc",
          "content": [
            {"type": "paragraph"},
            {"type": "paragraph", "content": [{"text": "Estimado/a {{client.first_name}},", "type": "text"}]},
            {"type": "paragraph", "content": [
              {"text": "Sus documentos legales han sido preparados. Puede encontrarlos adjuntos a este correo para su descarga y firma.", "type": "text"},
              {"type": "hardBreak"},
              {"type": "hardBreak"},
              {"text": "Una vez firmados y autenticados, enviarlos a la dirección indicada por su abogado.", "type": "text"},
              {"type": "hardBreak"}
            ]},
            {"type": "paragraph", "content": [{"text": "Gracias por confiar en nuestros servicios.", "type": "text"}]},
            {"type": "paragraph"}
          ]
        }
      }'::jsonb),

    -- 12. Set status → documents_sent
    (v_template_id, 'node-status-docs-sent', 'status_update', 'Documentos enviados', 820, 1082,
      '{"new_status": "documents_sent"}'::jsonb),

    -- 13. Manual action: confirm payment
    (v_template_id, 'node-manual-payment', 'manual_action', 'Marcar como Pagado', 523, 1266,
      '{
        "assignee": "lawyer",
        "instructions": "Confirmar recepción del pago del cliente para cerrar el proceso."
      }'::jsonb),

    -- 14. Set status → paid
    (v_template_id, 'node-status-paid', 'status_update', 'Proceso pagado', 840, 1266,
      '{"new_status": "paid"}'::jsonb),

    -- 15. Set status → finished
    (v_template_id, 'node-status-finished', 'status_update', 'Proceso finalizado', 542, 1487,
      '{"new_status": "finished"}'::jsonb),

    -- 16. End
    (v_template_id, 'node-end', 'end', 'Fin', 544, 1648, '{}'::jsonb);

  -- ── Edges (connections between nodes) ─────────────────────────────────────
  INSERT INTO public.workflow_edges (template_id, source_node_id, target_node_id) VALUES
    (v_template_id, 'node-start',                  'node-status-draft'),
    (v_template_id, 'node-status-draft',            'node-send-form-email'),
    (v_template_id, 'node-send-form-email',         'node-client-form'),
    (v_template_id, 'node-client-form',             'node-status-completed'),
    (v_template_id, 'node-status-completed',        'node-notify-lawyer'),
    (v_template_id, 'node-notify-lawyer',           'node-manual-review'),
    (v_template_id, 'node-manual-review',           'node-status-approved'),
    (v_template_id, 'node-status-approved',         'node-generate-doc'),
    -- fan-out: generate-doc → notify lawyer + send documents (parallel)
    (v_template_id, 'node-generate-doc',            'notify_lawyer-1774677841928'),
    (v_template_id, 'node-generate-doc',            'node-send-documents'),
    (v_template_id, 'node-send-documents',          'node-status-docs-sent'),
    (v_template_id, 'node-status-docs-sent',        'node-manual-payment'),
    (v_template_id, 'node-manual-payment',          'node-status-paid'),
    (v_template_id, 'node-status-paid',             'node-status-finished'),
    (v_template_id, 'node-status-finished',         'node-end');

  RAISE NOTICE 'Default workflow template seeded: %', v_template_id;
END $$;
