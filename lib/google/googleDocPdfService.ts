/**
 * lib/google/googleDocPdfService.ts
 *
 * Google-native PDF generation pipeline.
 *
 * Instead of fetching the Docs JSON and manually converting it to HTML for
 * Puppeteer, we delegate the entire rendering to Google's own engine:
 *
 *   1. copyTemplate()      — Drive API: files.copy → creates a temporary working copy
 *   2. replaceVariables()  — Docs API: documents.batchUpdate (replaceAllText)
 *                            Replaces {{VARIABLE}} in body + headers + footers atomically
 *   3. exportToPdf()       — Drive API: files.export (mimeType=application/pdf)
 *                            Returns the Buffer of the rendered PDF
 *   4. deleteDocument()    — Drive API: files.delete (cleanup, fire-and-forget)
 *
 * The resulting PDF is pixel-perfect because Google Docs renders it — fonts,
 * margins, images, tables, headers/footers all match what the user sees in
 * the Google Docs UI exactly.
 *
 * Required OAuth scopes (see lib/google/auth.ts):
 *   - drive.readonly   → read source template + export PDF
 *   - drive.file       → files.copy + documents.batchUpdate on copy + files.delete
 *   - userinfo.email   → identity (unchanged)
 */

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DOCS_API  = 'https://docs.googleapis.com/v1';

// ─── Error handling ───────────────────────────────────────────────────────────

async function throwApiError(res: Response, operation: string): Promise<never> {
  let detail = '';
  try {
    const body = await res.json() as { error?: { message?: string; status?: string } };
    detail = body.error?.message ?? '';
  } catch {
    detail = await res.text().catch(() => '');
  }

  if (res.status === 401) {
    throw new Error(
      'Token de Google expirado o revocado. Desconecta y vuelve a conectar tu cuenta en Configuración → Google Docs.',
    );
  }
  if (res.status === 403) {
    if (detail.toLowerCase().includes('insufficient')) {
      throw new Error(
        'Permisos insuficientes. Desconecta y vuelve a conectar tu cuenta de Google para renovar los permisos.',
      );
    }
    throw new Error(
      `Sin acceso al documento durante "${operation}". Verifica que el Google Doc esté compartido con la cuenta conectada. Detalle: ${detail}`,
    );
  }
  if (res.status === 404) {
    throw new Error(`Documento no encontrado durante "${operation}". Verifica que el ID del Google Doc sea correcto.`);
  }
  if (res.status === 429) {
    throw new Error('Límite de solicitudes de Google API excedido. Intenta de nuevo en unos segundos.');
  }
  throw new Error(`Error en "${operation}" (HTTP ${res.status}): ${detail}`);
}

// ─── Step 1: Copy template ────────────────────────────────────────────────────

/**
 * Creates a temporary copy of the Google Doc template in the user's Drive.
 * The copy is owned by the authenticated user and is not shared with anyone.
 *
 * @returns The `id` of the new (temporary) document.
 */
export async function copyTemplate(
  templateId: string,
  accessToken: string,
  copyName: string,
): Promise<string> {
  const res = await fetch(
    `${DRIVE_API}/files/${encodeURIComponent(templateId)}/copy`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: copyName }),
    },
  );

  if (!res.ok) await throwApiError(res, 'copiar plantilla');

  const data = await res.json() as { id: string };
  if (!data.id) throw new Error('La copia del documento no retornó un ID válido.');
  return data.id;
}

// ─── Step 2: Replace variables ────────────────────────────────────────────────

/**
 * Replaces all `{{VARIABLE}}` placeholders in the document (body, headers,
 * footers) using a single batchUpdate request.
 *
 * `replaceAllText` is case-sensitive and operates on the entire document
 * including all sections — no partial replacement possible.
 *
 * Variables with no matching placeholder are silently skipped.
 */
export async function replaceVariables(
  documentId: string,
  variables: Record<string, string>,
  accessToken: string,
): Promise<void> {
  const entries = Object.entries(variables);
  if (entries.length === 0) return;

  const requests = entries.map(([key, value]) => ({
    replaceAllText: {
      containsText: {
        text: `{${key}}`,
        matchCase: true,
      },
      replaceText: value,
    },
  }));

  const res = await fetch(
    `${DOCS_API}/documents/${encodeURIComponent(documentId)}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    },
  );

  if (!res.ok) await throwApiError(res, 'reemplazar variables');
}

// ─── Step 3: Export as PDF ────────────────────────────────────────────────────

/**
 * Exports the Google Doc as a PDF using Google's rendering engine.
 * The output is identical to File → Download → PDF in the Google Docs UI.
 *
 * @returns A Node.js Buffer containing the raw PDF bytes.
 */
export async function exportToPdf(
  documentId: string,
  accessToken: string,
): Promise<Buffer> {
  const url = new URL(`${DRIVE_API}/files/${encodeURIComponent(documentId)}/export`);
  url.searchParams.set('mimeType', 'application/pdf');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  if (!res.ok) await throwApiError(res, 'exportar PDF');

  return Buffer.from(await res.arrayBuffer());
}

// ─── Step 4: Delete temporary copy ───────────────────────────────────────────

/**
 * Permanently deletes a file from the user's Drive (bypasses trash).
 * Fire-and-forget: logs a warning on failure but does NOT throw, so a
 * failed cleanup never surfaces as a user-visible error.
 */
export async function deleteDocument(
  documentId: string,
  accessToken: string,
): Promise<void> {
  try {
    const res = await fetch(
      `${DRIVE_API}/files/${encodeURIComponent(documentId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!res.ok && res.status !== 404) {
      console.warn('[deleteDocument] Failed to delete temp doc', documentId, res.status);
    }
  } catch (err) {
    console.warn('[deleteDocument] Network error deleting temp doc', documentId, err);
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Verifies that a Drive file ID points to a native Google Doc.
 * Throws a user-friendly error if the file is a Word doc, PDF, Slides, etc.
 * Call this before saving a google_doc_template to the DB.
 */
export async function validateGoogleDocMimeType(
  docId: string,
  accessToken: string,
): Promise<void> {
  const url = `${DRIVE_API}/files/${encodeURIComponent(docId)}?fields=mimeType%2Cname`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  if (res.status === 404) {
    throw new Error('Google Doc no encontrado. Verifica que el ID sea correcto y que el documento exista.');
  }
  if (res.status === 403) {
    throw new Error('Sin acceso al documento. Verifica que esté compartido con tu cuenta de Google conectada.');
  }
  if (!res.ok) {
    throw new Error(`Error verificando el documento (${res.status}). Intenta de nuevo.`);
  }

  const { mimeType, name } = await res.json() as { mimeType: string; name: string };
  if (mimeType !== 'application/vnd.google-apps.document') {
    throw new Error(
      `"${name}" no es un Google Doc nativo. ` +
      'En Google Drive, haz clic derecho sobre el archivo → "Abrir con" → "Google Docs" para convertirlo, ' +
      'luego copia el enlace del documento convertido.',
    );
  }
}
