-- ============================================
-- MIGRATION: workflow_node_type_wait_email_reply
-- Description: Agrega el valor 'wait_email_reply' al enum workflow_node_type
--   — nuevo tipo de nodo que envía un correo y queda esperando la respuesta
--   del cliente (con adjuntos) vía un Reply-To controlado por Aurali. Esta
--   migración va SOLA: Postgres no permite usar un valor de enum recién
--   agregado (ALTER TYPE ... ADD VALUE) dentro de la misma transacción en la
--   que se agregó — cualquier migración que lo referencie debe ir en un
--   archivo posterior.
-- Date: 2026-09-13
-- ============================================

ALTER TYPE public.workflow_node_type ADD VALUE IF NOT EXISTS 'wait_email_reply';
