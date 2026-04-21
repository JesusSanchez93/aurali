# Index Best Practices — Aurali

## Reglas de Oro para Índices

### 1. **SIEMPRE indexar Foreign Keys**
```sql
-- ✅ CORRECTO
CREATE INDEX IF NOT EXISTS idx_legal_processes_org_id 
  ON public.legal_processes(organization_id);

CREATE INDEX IF NOT EXISTS idx_legal_processes_assigned_to 
  ON public.legal_processes(assigned_to);

-- ❌ INCORRECTO: FK sin índice = JOIN lento
```

**Por qué:** PostgreSQL no indexa FKs automáticamente. Sin índice, los JOINs hacen table scans.

---

### 2. **Indexar columnas en WHERE frecuentes**

Analiza tus queries comunes:

```typescript
// Query frecuente en el código
const processes = await db.legal_processes.findMany({
  where: { 
    organization_id: orgId,
    status: 'active'
  }
});
```

```sql
-- ✅ Índice compuesto para este query
CREATE INDEX IF NOT EXISTS idx_legal_processes_org_status 
  ON public.legal_processes(organization_id, status);
```

**Orden importa:** Columna más selectiva primero (usualmente `organization_id`).

---

### 3. **Partial Indexes para filtros constantes**

```sql
-- Query: "dame procesos activos de mi org"
-- ✅ Partial index (más pequeño, más rápido)
CREATE INDEX IF NOT EXISTS idx_legal_processes_active 
  ON public.legal_processes(organization_id) 
  WHERE status = 'active';

-- También útil para:
WHERE deleted_at IS NULL
WHERE published = true
WHERE active = true
```

**Beneficio:** Índice ~50% más pequeño = más rápido + menos espacio.

---

### 4. **Timestamps con DESC para ORDER BY reciente**

```sql
-- Query: "últimos procesos creados"
SELECT * FROM legal_processes 
WHERE organization_id = '...'
ORDER BY created_at DESC
LIMIT 10;

-- ✅ Índice con DESC
CREATE INDEX IF NOT EXISTS idx_legal_processes_created_at 
  ON public.legal_processes(organization_id, created_at DESC);
```

---

### 5. **GIN indexes para búsqueda de texto**

```sql
-- Habilitar extensión primero (una sola vez)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Para búsquedas LIKE / ILIKE
CREATE INDEX IF NOT EXISTS idx_clients_name_trgm 
  ON public.clients USING gin(firstname gin_trgm_ops);

-- Ahora este query usa el índice:
SELECT * FROM clients WHERE firstname ILIKE '%juan%';
```

**Casos de uso:**
- Búsqueda de clientes por nombre
- Búsqueda de bancos por nombre
- Autocompletado

---

### 6. **JSONB indexes para columnas JSON**

```sql
-- Para columnas JSONB frecuentemente consultadas
CREATE INDEX IF NOT EXISTS idx_workflow_nodes_data 
  ON public.workflow_nodes USING gin(data);

-- O para una key específica:
CREATE INDEX IF NOT EXISTS idx_workflow_nodes_type 
  ON public.workflow_nodes((data->>'type'));
```

---

### 7. **Evita sobre-indexar**

**❌ NO crear índices para:**
- Columnas con baja cardinalidad (ej: `boolean` con 2 valores)
- Columnas que nunca usas en WHERE/JOIN/ORDER BY
- Tablas muy pequeñas (<1000 rows)

**Costo de índices:**
- Espacio en disco
- Lentitud en INSERT/UPDATE/DELETE
- Más trabajo para el query planner

**Regla:** Si un índice no mejora un query real, no lo crees.

---

## Convención de Nombres

```sql
-- Patrón: idx_<tabla>_<columnas>_[condición]

idx_legal_processes_org_id                    -- FK simple
idx_legal_processes_org_status                -- Compuesto
idx_legal_processes_created_at                -- Timestamp
idx_legal_processes_active                    -- Partial index
idx_clients_name_trgm                         -- GIN text search
idx_workflow_nodes_data                       -- JSONB
```

---

## Checklist por Tabla

Cuando creas una tabla nueva, pregunta:

- [ ] ¿Tiene `organization_id`? → Índice
- [ ] ¿Tiene otros FKs? → Índice en cada uno
- [ ] ¿Qué queries harán WHERE en esta tabla? → Índice compuesto
- [ ] ¿Se ordena por timestamp? → Índice con DESC
- [ ] ¿Tiene búsqueda de texto? → GIN trigram
- [ ] ¿Hay filtros constantes (status='active')? → Partial index
- [ ] ¿Tiene columnas JSONB consultadas? → GIN o expresión

---

## Ejemplo Completo: Tabla `legal_processes`

```sql
-- Tabla con ~10 columnas, ~1000-10000 rows esperadas

-- 1. FK principal (siempre en WHERE)
CREATE INDEX IF NOT EXISTS idx_legal_processes_org_id 
  ON public.legal_processes(organization_id);

-- 2. FK secundario (para asignaciones)
CREATE INDEX IF NOT EXISTS idx_legal_processes_assigned_to 
  ON public.legal_processes(assigned_to);

-- 3. Query común: "procesos activos de mi org"
CREATE INDEX IF NOT EXISTS idx_legal_processes_org_status 
  ON public.legal_processes(organization_id, status);

-- 4. Ordenamiento: "últimos procesos"
CREATE INDEX IF NOT EXISTS idx_legal_processes_created_at 
  ON public.legal_processes(organization_id, created_at DESC);

-- 5. Partial index: "solo procesos activos"
CREATE INDEX IF NOT EXISTS idx_legal_processes_active 
  ON public.legal_processes(organization_id, created_at DESC) 
  WHERE status = 'active';

-- 6. Búsqueda por número consecutivo
CREATE INDEX IF NOT EXISTS idx_legal_processes_consecutive 
  ON public.legal_processes(organization_id, consecutive_number);
```

**Total:** 6 índices para ~10 columnas. Ratio ~0.6 índices/columna es saludable.

---

## Validar Performance de Índices

```sql
-- Ver si un query usa índices
EXPLAIN ANALYZE
SELECT * FROM legal_processes 
WHERE organization_id = '...' AND status = 'active';

-- Busca: "Index Scan" (✅) vs "Seq Scan" (❌)
```

---

## Índices a Crear AHORA en Aurali

Estas tablas necesitan índices basados en TECHNICAL.md:

### Alta prioridad
```sql
-- legal_processes
CREATE INDEX IF NOT EXISTS idx_legal_processes_org_status ON legal_processes(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_legal_processes_assigned_to ON legal_processes(assigned_to);
CREATE INDEX IF NOT EXISTS idx_legal_processes_created_at ON legal_processes(organization_id, created_at DESC);

-- clients
CREATE INDEX IF NOT EXISTS idx_clients_org_id ON clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(organization_id, email);
CREATE INDEX IF NOT EXISTS idx_clients_name_trgm ON clients USING gin(firstname gin_trgm_ops);

-- workflow_runs
CREATE INDEX IF NOT EXISTS idx_workflow_runs_process ON workflow_runs(process_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_template ON workflow_runs(template_id);

-- workflow_step_runs
CREATE INDEX IF NOT EXISTS idx_workflow_step_runs_run ON workflow_step_runs(run_id, status);

-- generated_documents
CREATE INDEX IF NOT EXISTS idx_generated_documents_process ON generated_documents(process_id);

-- organization_members
CREATE INDEX IF NOT EXISTS idx_organization_members_profile ON organization_members(profile_id, active);
CREATE INDEX IF NOT EXISTS idx_organization_members_org ON organization_members(org_id, active);

-- banks
CREATE INDEX IF NOT EXISTS idx_banks_org_id ON banks(organization_id);
```

**Esfuerzo total:** 1 migración, ~30 minutos.
