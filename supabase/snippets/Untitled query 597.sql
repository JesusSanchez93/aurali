-- Verificar si existen plantillas para la org
SELECT id, name, organization_id FROM document_templates LIMIT 10;

-- Verificar que el usuario esta activo en organization_members
SELECT * FROM organization_members WHERE user_id = auth.uid() AND active = true;
