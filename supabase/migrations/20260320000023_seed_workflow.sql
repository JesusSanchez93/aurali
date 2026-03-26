-- =============================================================================
-- Seed: Default "Proceso Legal General" workflow template
-- organization_id = NULL → global, available to all orgs
--
-- Flow (15 nodes, 14 edges):
--   start → draft → send_form_email → client_form [BLOCKING]
--   → completed → notify_lawyer → manual_review [BLOCKING]
--   → approved → generate_doc → send_documents → docs_sent
--   → manual_payment [BLOCKING] → paid → finished → end
-- =============================================================================

DO $$
DECLARE
  v_template_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.workflow_templates
    WHERE name = 'Proceso Legal General' AND organization_id IS NULL
  ) THEN
    RAISE NOTICE 'Default workflow already seeded — skipping.';
    RETURN;
  END IF;

  INSERT INTO public.workflow_templates (organization_id, name, description, is_default)
  VALUES (
    NULL,
    'Proceso Legal General',
    'Flujo estándar: captación del cliente, recopilación de datos, revisión del abogado, generación y envío de documentos.',
    TRUE
  )
  RETURNING id INTO v_template_id;

  -- ── Nodes ──────────────────────────────────────────────────────────────────

  INSERT INTO public.workflow_nodes (template_id, node_id, type, title, config, position_x, position_y)
  VALUES

    -- 1. Inicio
    (v_template_id, 'node-start', 'start', 'Inicio', '{}', 540, -168),

    -- 2. Status: borrador
    (v_template_id, 'node-status-draft', 'status_update', 'Crear proceso',
      '{"new_status": "draft"}', 797, -167),

    -- 3. Email formulario al cliente
    (v_template_id, 'node-send-form-email', 'send_email', 'Enviar formulario al cliente',
      jsonb_build_object(
        'to',             '{{client.email}}',
        'subject',        'Complete su información — {{process.id}}',
        'email_template', 'client_form_email',
        'body', '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Estimado/a {{client.first_name}},"}]},{"type":"paragraph"},{"type":"paragraph","content":[{"type":"text","text":"Hemos iniciado su proceso legal. Por favor complete el formulario en el siguiente enlace:"}]},{"type":"paragraph"},{"type":"paragraph","content":[{"type":"text","text":"{{form_url}}"}]},{"type":"paragraph"},{"type":"paragraph","content":[{"type":"text","text":"Este enlace es válido por 72 horas."}]}]}'::jsonb
      ), 529, 97),

    -- 4. Formulario del cliente [BLOCKING]
    (v_template_id, 'node-client-form', 'client_form', 'Datos del cliente',
      jsonb_build_object(
        'title',       'Información personal',
        'description', 'Por favor complete sus datos personales para continuar con el proceso.',
        'fields', jsonb_build_array(
          jsonb_build_object('name','first_name',      'label','Nombres',             'type','text',   'required',true),
          jsonb_build_object('name','last_name',        'label','Apellidos',           'type','text',   'required',true),
          jsonb_build_object('name','document_type',    'label','Tipo de documento',   'type','select', 'required',true,
            'options', jsonb_build_array('CC','CE','NIT','PP','TE')),
          jsonb_build_object('name','document_number',  'label','Número de documento', 'type','text',   'required',true),
          jsonb_build_object('name','address',          'label','Dirección',           'type','text',   'required',false),
          jsonb_build_object('name','phone',            'label','Teléfono',            'type','text',   'required',true),
          jsonb_build_object('name','email',            'label','Correo electrónico',  'type','email',  'required',true)
        )
      ), 530, 232),

    -- 5. Status: completado
    (v_template_id, 'node-status-completed', 'status_update', 'Datos recibidos',
      '{"new_status": "completed"}', 841, 233),

    -- 6. Notificar al abogado
    (v_template_id, 'node-notify-lawyer', 'notify_lawyer', 'Notificar al abogado',
      jsonb_build_object(
        'message',    E'El cliente {{client.first_name}} {{client.last_name}} completó el formulario del proceso {{process.id}}.\n\nPor favor revise los datos y apruebe para continuar.',
        'recipients', 'lawyer'
      ), 541, 524),

    -- 7. Acción manual: revisión del abogado [BLOCKING]
    (v_template_id, 'node-manual-review', 'manual_action', 'Revisión del abogado',
      jsonb_build_object(
        'assignee',     'lawyer',
        'instructions', E'1. Verificar identidad del cliente.\n2. Confirmar datos de contacto.\n3. Aprobar para proceder con la generación de documentos.'
      ), 541, 656),

    -- 8. Status: aprobado
    (v_template_id, 'node-status-approved', 'status_update', 'Proceso aprobado',
      '{"new_status": "approved"}', 817, 657),

    -- 9. Generar documentos
    --    template_ids se configura por org en el WorkflowBuilder (NodeConfigPanel).
    (v_template_id, 'node-generate-doc', 'generate_document', 'Generar documentos',
      jsonb_build_object(
        'template_ids',  '[]'::jsonb,
        'document_name', 'Contrato_{{client.first_name}}_{{client.last_name}}'
      ), 540, 932),

    -- 10. Email: enviar documentos al cliente
    --     attach_document_template_ids se configura por org en el WorkflowBuilder.
    (v_template_id, 'node-send-documents', 'send_email', 'Enviar documentos al cliente',
      jsonb_build_object(
        'to',                          '{{client.email}}',
        'subject',                     'Sus documentos legales están listos',
        'attach_enabled',              true,
        'attach_document_template_ids','[]'::jsonb,
        'body', '{"type":"doc","content":[{"type":"paragraph"},{"type":"paragraph","content":[{"type":"text","text":"Estimado/a {{client.first_name}},"}]},{"type":"paragraph","content":[{"type":"text","text":"Sus documentos legales han sido preparados. Puede encontrarlos adjuntos a este correo para su descarga y firma."},{"type":"hardBreak"},{"type":"hardBreak"},{"type":"text","text":"Una vez firmados y autenticados, enviarlos a la dirección indicada por su abogado."},{"type":"hardBreak"}]},{"type":"paragraph","content":[{"type":"text","text":"Gracias por confiar en nuestros servicios."}]},{"type":"paragraph"}]}'::jsonb
      ), 523, 1082),

    -- 11. Status: documentos enviados
    (v_template_id, 'node-status-docs-sent', 'status_update', 'Documentos enviados',
      '{"new_status": "documents_sent"}', 820, 1082),

    -- 12. Acción manual: marcar como pagado [BLOCKING]
    (v_template_id, 'node-manual-payment', 'manual_action', 'Marcar como Pagado',
      jsonb_build_object(
        'assignee',     'lawyer',
        'instructions', 'Confirmar recepción del pago del cliente para cerrar el proceso.'
      ), 523, 1266),

    -- 13. Status: pagado
    (v_template_id, 'node-status-paid', 'status_update', 'Proceso pagado',
      '{"new_status": "paid"}', 840, 1266),

    -- 14. Status: finalizado
    (v_template_id, 'node-status-finished', 'status_update', 'Proceso finalizado',
      '{"new_status": "finished"}', 542, 1487),

    -- 15. Fin
    (v_template_id, 'node-end', 'end', 'Fin', '{}', 544, 1648);


  -- ── Edges (14) ─────────────────────────────────────────────────────────────

  INSERT INTO public.workflow_edges (template_id, source_node_id, target_node_id, condition)
  VALUES
    (v_template_id, 'node-start',              'node-status-draft',     NULL),
    (v_template_id, 'node-status-draft',        'node-send-form-email',  NULL),
    (v_template_id, 'node-send-form-email',     'node-client-form',      NULL),
    (v_template_id, 'node-client-form',         'node-status-completed', NULL),
    (v_template_id, 'node-status-completed',    'node-notify-lawyer',    NULL),
    (v_template_id, 'node-notify-lawyer',       'node-manual-review',    NULL),
    (v_template_id, 'node-manual-review',       'node-status-approved',  NULL),
    (v_template_id, 'node-status-approved',     'node-generate-doc',     NULL),
    (v_template_id, 'node-generate-doc',        'node-send-documents',   NULL),
    (v_template_id, 'node-send-documents',      'node-status-docs-sent', NULL),
    (v_template_id, 'node-status-docs-sent',    'node-manual-payment',   NULL),
    (v_template_id, 'node-manual-payment',      'node-status-paid',      NULL),
    (v_template_id, 'node-status-paid',         'node-status-finished',  NULL),
    (v_template_id, 'node-status-finished',     'node-end',              NULL);

  RAISE NOTICE 'Default workflow seeded: %', v_template_id;
END $$;
