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
 * Extracts `**bold**` spans from a variable value. `replaceAllText` (used by
 * `replaceVariables()` below) can only insert plain text — formatting has to
 * be applied afterwards as a separate range-scoped `updateTextStyle` request.
 * Returns the text with the `**` markers stripped, plus the offset ranges
 * (within that stripped text) that should be rendered bold.
 */
function parseBoldMarkdown(text: string): { plainText: string; boldRanges: { start: number; end: number }[] } {
  const boldRanges: { start: number; end: number }[] = [];
  let plainText = '';
  let lastIndex = 0;
  const re = /\*\*(.+?)\*\*/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    plainText += text.slice(lastIndex, match.index);
    const start = plainText.length;
    plainText += match[1];
    boldRanges.push({ start, end: plainText.length });
    lastIndex = re.lastIndex;
  }
  plainText += text.slice(lastIndex);
  return { plainText, boldRanges };
}

/**
 * Replaces all `{VARIABLE}` placeholders in the document (body, headers,
 * footers) using a single batchUpdate request.
 *
 * Variables ending in `_IMG` are excluded — they are handled separately by
 * `insertImageVariables()` which inlines the image at the placeholder position.
 *
 * Values containing `**bold**` markers (e.g. Claude-generated clauses, see
 * lib/anthropic/resolveAiVariables.ts) get the markers stripped before
 * substitution, then — in a second pass — the doc is re-read once to locate
 * each inserted value and precise `updateTextStyle` requests are issued for
 * the bold ranges. `replaceAllText` itself cannot carry per-range formatting,
 * so this mirrors the marker+index-lookup approach `insertImageVariables()`
 * uses for images. Values without `**` skip this entirely (no extra API
 * calls) — same cost as before.
 */
export async function replaceVariables(
  documentId: string,
  variables: Record<string, string>,
  accessToken: string,
): Promise<void> {
  const entries = Object.entries(variables).filter(([key]) => !key.endsWith('_IMG'));
  if (entries.length === 0) return;

  const formatted = new Map<string, { plainText: string; boldRanges: { start: number; end: number }[] }>();
  const requests = entries.map(([key, value]) => {
    let replaceText = value;
    if (value.includes('**')) {
      const parsed = parseBoldMarkdown(value);
      if (parsed.boldRanges.length > 0) {
        formatted.set(key, parsed);
        replaceText = parsed.plainText;
      }
    }
    return {
      replaceAllText: {
        containsText: {
          text: `{${key}}`,
          matchCase: true,
        },
        replaceText,
      },
    };
  });

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
  if (formatted.size === 0) return;

  // ── Second pass: locate each formatted value and apply bold ranges ───────
  // Limitation: only searches doc.body.content (not headers/footers), and
  // assumes the inserted text is reasonably unique in the doc — same
  // trade-off insertImageVariables() already makes for image markers.
  const docRes = await fetch(`${DOCS_API}/documents/${encodeURIComponent(documentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!docRes.ok) await throwApiError(docRes, 'leer documento para aplicar formato de texto');
  const doc = await docRes.json() as GoogleDocJson;

  const styleRequests: unknown[] = [];
  for (const [key, { plainText, boldRanges }] of formatted) {
    const startIndex = searchElements(doc.body?.content ?? [], plainText);
    if (startIndex === null) {
      console.warn(`[replaceVariables] Formatted value for ${key} not found after replacement, skipping bold`);
      continue;
    }
    for (const range of boldRanges) {
      styleRequests.push({
        updateTextStyle: {
          range: { startIndex: startIndex + range.start, endIndex: startIndex + range.end },
          textStyle: { bold: true },
          fields: 'bold',
        },
      });
    }
  }
  if (styleRequests.length === 0) return;

  const styleRes = await fetch(
    `${DOCS_API}/documents/${encodeURIComponent(documentId)}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests: styleRequests }),
    },
  );
  if (!styleRes.ok) await throwApiError(styleRes, 'aplicar formato de texto');
}

// ─── Step 2b: Insert image variables ─────────────────────────────────────────

type DocTextRun = { content: string };
type DocParagraphElement = { startIndex?: number; textRun?: DocTextRun };
type DocParagraph = { elements?: DocParagraphElement[] };
type DocTableCell = { content?: DocStructuralElement[] };
type DocTableRow = { tableCells?: DocTableCell[] };
type DocTable = { tableRows?: DocTableRow[] };
type DocStructuralElement = { paragraph?: DocParagraph; table?: DocTable };
type GoogleDocJson = { body?: { content?: DocStructuralElement[] } };

function searchParagraph(elements: DocParagraphElement[], placeholder: string): number | null {
  let text = '';
  const indexMap: number[] = [];
  for (const el of elements) {
    if (el.textRun?.content != null && el.startIndex != null) {
      for (let i = 0; i < el.textRun.content.length; i++) {
        indexMap.push(el.startIndex + i);
        text += el.textRun.content[i];
      }
    }
  }
  const pos = text.indexOf(placeholder);
  return pos === -1 ? null : indexMap[pos];
}

function searchElements(elements: DocStructuralElement[], placeholder: string): number | null {
  for (const el of elements) {
    if (el.paragraph) {
      const idx = searchParagraph(el.paragraph.elements ?? [], placeholder);
      if (idx !== null) return idx;
    }
    if (el.table) {
      for (const row of el.table.tableRows ?? []) {
        for (const cell of row.tableCells ?? []) {
          const idx = searchElements(cell.content ?? [], placeholder);
          if (idx !== null) return idx;
        }
      }
    }
  }
  return null;
}

/**
 * For each variable ending in `_IMG`, replaces its `{KEY}` placeholder with an
 * inline image using a 3-step approach:
 *
 *   1. replaceAllText → clean ASCII marker  (fixes text-run splitting in Google Docs)
 *   2. Read doc       → find marker's exact index
 *   3. batchUpdate    → insertInlineImage + deleteContentRange (removes marker)
 *
 * The image URI must be publicly accessible. For private Supabase Storage
 * buckets, pass a fresh signed URL (see resolveImageUrls() in generateFromDoc.ts).
 */
export async function insertImageVariables(
  documentId: string,
  variables: Record<string, string>,
  accessToken: string,
): Promise<void> {
  const imgEntries = Object.entries(variables).filter(
    ([key, value]) => key.endsWith('_IMG') && value,
  );
  if (imgEntries.length === 0) return;

  for (const [key, url] of imgEntries) {
    const placeholder = `{${key}}`;
    const marker = `AURALI_IMG_${key.replace(/[^A-Z0-9]/g, '_')}`;

    // Step 1: Replace placeholder with clean marker (handles split text runs)
    const replaceRes = await fetch(
      `${DOCS_API}/documents/${encodeURIComponent(documentId)}:batchUpdate`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            replaceAllText: {
              containsText: { text: placeholder, matchCase: true },
              replaceText: marker,
            },
          }],
        }),
      },
    );
    if (!replaceRes.ok) await throwApiError(replaceRes, `preparar marcador de imagen (${key})`);

    // Step 2: Read doc to find the marker's exact index
    const docRes = await fetch(`${DOCS_API}/documents/${encodeURIComponent(documentId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!docRes.ok) await throwApiError(docRes, `leer documento para insertar imagen (${key})`);
    const doc = await docRes.json() as GoogleDocJson;

    const startIndex = searchElements(doc.body?.content ?? [], marker);
    if (startIndex === null) {
      console.warn(`[insertImageVariables] Marker for ${key} not found after replacement, skipping`);
      continue;
    }

    // Step 3: Insert image at marker position, then delete the marker
    const insertRes = await fetch(
      `${DOCS_API}/documents/${encodeURIComponent(documentId)}:batchUpdate`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              insertInlineImage: {
                location: { index: startIndex },
                uri: url,
                objectSize: {
                  width: { magnitude: 120, unit: 'PT' },
                  height: { magnitude: 60, unit: 'PT' },
                },
              },
            },
            {
              deleteContentRange: {
                range: {
                  startIndex: startIndex + 1, // +1: inserted image occupies one index slot
                  endIndex: startIndex + 1 + marker.length,
                },
              },
            },
          ],
        }),
      },
    );

    if (!insertRes.ok) await throwApiError(insertRes, `insertar imagen de firma (${key})`);
  }
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
