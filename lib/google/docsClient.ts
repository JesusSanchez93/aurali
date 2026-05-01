/**
 * lib/google/docsClient.ts
 *
 * Obtiene y convierte el contenido de un Google Doc a HTML limpio.
 *
 * Usa la Google Docs API (/v1/documents/{id}) en vez del export HTML de Drive
 * porque el export HTML falla con error 500 en documentos que tienen encabezados
 * con imágenes u otras características avanzadas.
 *
 * La Docs API también devuelve los encabezados y pies de página nativos,
 * que se usan como templates de Puppeteer en el pipeline de PDF.
 *
 * Scope requerido: drive.readonly (ya incluido) o documents.readonly
 */

export interface CleanedGoogleDoc {
  /** Contenido del cuerpo del documento en HTML */
  bodyHtml: string;
  /**
   * Contenido del encabezado nativo en HTML (imágenes embebidas como base64).
   * Vacío si el documento no tiene encabezado.
   */
  headerHtml: string;
  /**
   * Contenido del pie de página nativo en HTML.
   * Vacío si el documento no tiene pie de página.
   */
  footerHtml: string;
  /** Document page margins in cm, from documentStyle */
  margins: { top: number; bottom: number; left: number; right: number };
  /** Primary font family from NORMAL_TEXT named style (e.g. 'Arial') */
  fontFamily: string;
}

// ─── Drive HTML export (legacy) ───────────────────────────────────────────────

/**
 * @deprecated Falla con 500 en documentos con encabezados/imágenes complejas.
 * Usar fetchGoogleDocContent() en su lugar.
 */
export async function fetchGoogleDocAsHtml(docId: string, accessToken: string): Promise<string> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(docId)}/export?mimeType=text%2Fhtml`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Error al exportar Google Doc como HTML (${res.status}): ${await res.text()}`);
  return res.text();
}

// ─── Google Docs API ──────────────────────────────────────────────────────────

/**
 * Obtiene el Google Doc como JSON estructurado via la Docs API.
 * Incluye body, headers, footers e inlineObjects (imágenes).
 *
 * drive.readonly es suficiente para acceder a la Docs API.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchGoogleDocJson(docId: string, accessToken: string): Promise<any> {
  const url = `https://docs.googleapis.com/v1/documents/${encodeURIComponent(docId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  if (res.status === 401) {
    throw new Error('Token de Google expirado o revocado. Reconecta la cuenta en Configuración → Google Docs.');
  }
  if (res.status === 403) {
    const wwwAuth = res.headers.get('www-authenticate') ?? '';
    const body = await res.text();
    console.error('[fetchGoogleDocJson] 403 body:', body);
    if (wwwAuth.includes('insufficient_scope')) {
      throw new Error('Permisos insuficientes. Desconecta y vuelve a conectar tu cuenta de Google en Configuración → Google Docs para renovar los permisos.');
    }
    throw new Error('Sin acceso al documento. Verifica que el Google Doc esté compartido con la cuenta conectada.');
  }
  if (res.status === 404) {
    throw new Error('Google Doc no encontrado. Verifica que el ID sea correcto y que la cuenta tenga acceso.');
  }
  if (!res.ok) {
    const body = await res.text();
    if (body.includes('FAILED_PRECONDITION')) {
      throw new Error(
        'Este archivo no es un Google Doc nativo. En Google Drive, haz clic derecho → "Abrir con" → "Google Docs" para convertirlo y usa el nuevo enlace.',
      );
    }
    throw new Error(`Error al obtener el Google Doc (${res.status}): ${body}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return res.json() as Promise<any>;
}

/**
 * Obtiene el contenido de un Google Doc como HTML limpio, incluyendo
 * encabezado y pie de página nativos del documento.
 *
 * Las imágenes se descargan y se embeben como data URIs base64 para que
 * funcionen en el contexto aislado de Puppeteer.
 */
export async function fetchGoogleDocContent(
  docId: string,
  accessToken: string,
): Promise<CleanedGoogleDoc> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = await fetchGoogleDocJson(docId, accessToken) as any;

  // Build a unified image cache from both inlineObjects and positionedObjects.
  // Positioned objects (floating/anchored images) live in doc.positionedObjects
  // and are referenced via paragraph.positionedObjectIds — distinct from inline images.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allInlineObjects: Record<string, any> = doc.inlineObjects ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allPositionedObjects: Record<string, any> = doc.positionedObjects ?? {};
  const imageCache = await buildImageCache(allInlineObjects, allPositionedObjects, accessToken);

  const namedStyles = buildNamedStyleMap(doc);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lists: Record<string, any> = doc.lists ?? {};
  const ctx: RenderContext = {
    imageCache,
    inlineObjects: allInlineObjects,
    positionedObjects: allPositionedObjects,
    namedStyles,
    lists,
  };

  const margins = extractDocMargins(doc);
  const fontFamily = extractFontFamily(namedStyles);

  const bodyHtml = contentToHtml(doc.body?.content ?? [], ctx).trim();
  const defaultHeaderId = doc.documentStyle?.defaultHeaderId as string | undefined;
  const defaultFooterId = doc.documentStyle?.defaultFooterId as string | undefined;

  const headerHtml = defaultHeaderId && doc.headers?.[defaultHeaderId]
    ? contentToHtml(doc.headers[defaultHeaderId].content ?? [], ctx).trim()
    : '';

  const footerHtml = defaultFooterId && doc.footers?.[defaultFooterId]
    ? contentToHtml(doc.footers[defaultFooterId].content ?? [], ctx).trim()
    : '';

  return { bodyHtml, headerHtml, footerHtml, margins, fontFamily };
}

// ─── Image helpers ────────────────────────────────────────────────────────────

async function buildImageCache(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inlineObjects: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  positionedObjects: Record<string, any>,
  accessToken: string,
): Promise<Record<string, string>> {
  const cache: Record<string, string> = {};
  const entries: Array<{ id: string; uri: string }> = [];

  for (const [id, obj] of Object.entries(inlineObjects)) {
    const imageProps = obj?.inlineObjectProperties?.embeddedObject?.imageProperties;
    const uri = imageProps?.contentUri ?? imageProps?.sourceUri ?? '';
    if (uri) entries.push({ id, uri });
  }
  for (const [id, obj] of Object.entries(positionedObjects)) {
    const imageProps = obj?.positionedObjectProperties?.embeddedObject?.imageProperties;
    const uri = imageProps?.contentUri ?? imageProps?.sourceUri ?? '';
    if (uri) entries.push({ id, uri });
  }

  const results = await Promise.all(
    entries.map(({ id, uri }) => fetchImageAsBase64(uri, accessToken).then((src) => ({ id, src }))),
  );
  for (const { id, src } of results) {
    if (src !== null) cache[id] = src;
  }
  return cache;
}

async function fetchImageAsBase64(url: string, accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      console.warn('[fetchImageAsBase64] HTTP', res.status, 'skipping image:', url);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get('content-type') ?? 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch (err) {
    console.warn('[fetchImageAsBase64] Skipping image (download failed):', url, err);
    return null;
  }
}

// ─── Docs JSON → HTML ─────────────────────────────────────────────────────────

interface RenderContext {
  imageCache: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inlineObjects: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  positionedObjects: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  namedStyles: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lists: Record<string, any>;
}

// ─── Style helpers ────────────────────────────────────────────────────────────

function ptToCss(pt: number): string {
  return `${(pt / 28.3465).toFixed(4)}cm`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rgbToCss(rgb: any): string {
  const r = Math.round((rgb.red   ?? 0) * 255);
  const g = Math.round((rgb.green ?? 0) * 255);
  const b = Math.round((rgb.blue  ?? 0) * 255);
  return `rgb(${r},${g},${b})`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildNamedStyleMap(doc: any): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map: Record<string, any> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const s of (doc.namedStyles?.styles ?? []) as any[]) {
    if (s.namedStyleType) map[s.namedStyleType as string] = s;
  }
  return map;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractDocMargins(doc: any): { top: number; bottom: number; left: number; right: number } {
  const ds = doc.documentStyle ?? {};
  const PT_DEFAULT = 72; // 1 inch
  const toPt = (field: string): number =>
    (ds[field]?.magnitude as number | undefined) ?? PT_DEFAULT;
  return {
    top:    parseFloat((toPt('marginTop')    / 28.3465).toFixed(4)),
    bottom: parseFloat((toPt('marginBottom') / 28.3465).toFixed(4)),
    left:   parseFloat((toPt('marginLeft')   / 28.3465).toFixed(4)),
    right:  parseFloat((toPt('marginRight')  / 28.3465).toFixed(4)),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFontFamily(namedStyles: Record<string, any>): string {
  return (namedStyles['NORMAL_TEXT']?.textStyle?.weightedFontFamily?.fontFamily as string | undefined) ?? 'Arial';
}

// ─── Content rendering ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function contentToHtml(content: any[], ctx: RenderContext): string {
  let html = '';
  let i = 0;
  while (i < content.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const el = content[i] as any;
    if (el.paragraph?.bullet) {
      const { listHtml, consumed } = renderListGroup(content, i, ctx);
      html += listHtml;
      i += consumed;
    } else {
      html += elementToHtml(el, ctx);
      i++;
    }
  }
  return html;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function elementToHtml(el: any, ctx: RenderContext): string {
  if (el.paragraph) return paragraphToHtml(el.paragraph, ctx);
  if (el.table)     return tableToHtml(el.table, ctx);
  if (el.sectionBreak) {
    const type = el.sectionBreak.sectionStyle?.sectionType as string | undefined;
    return type === 'NEXT_PAGE' ? '<div style="page-break-after:always;"></div>' : '';
  }
  return '';
}

const ORDERED_GLYPH_TYPES = new Set([
  'DECIMAL', 'ALPHA', 'ROMAN', 'UPPER_ALPHA', 'UPPER_ROMAN', 'LOWER_ALPHA', 'LOWER_ROMAN',
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderListGroup(content: any[], startIdx: number, ctx: RenderContext): { listHtml: string; consumed: number } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const firstEl = content[startIdx] as any;
  const startListId = firstEl.paragraph.bullet.listId as string;

  let html = '';
  let consumed = 0;
  // Stack tracks { tag, level } for open list elements
  const stack: Array<{ tag: string; level: number }> = [];

  const getTag = (listId: string, level: number): string => {
    const glyphType = ctx.lists[listId]?.listProperties?.nestingLevels?.[level]?.glyphType as string | undefined;
    return glyphType && ORDERED_GLYPH_TYPES.has(glyphType) ? 'ol' : 'ul';
  };

  let currentListId = startListId;

  while (startIdx + consumed < content.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const el = content[startIdx + consumed] as any;
    if (!el.paragraph?.bullet) break;

    const bullet = el.paragraph.bullet;
    const listId  = bullet.listId as string;
    const level   = (bullet.nestingLevel as number | undefined) ?? 0;

    // If listId changed, close all open levels and start fresh
    if (listId !== currentListId) {
      while (stack.length > 0) {
        html += `</${stack.pop()!.tag}>`;
      }
      currentListId = listId;
    }

    const tag = getTag(listId, level);

    // Close levels deeper than current
    while (stack.length > 0 && stack[stack.length - 1].level > level) {
      html += `</${stack.pop()!.tag}>`;
    }

    // Open new level if needed
    if (stack.length === 0 || stack[stack.length - 1].level < level) {
      html += `<${tag} style="margin:0.2em 0;padding-left:1.5em;">`;
      stack.push({ tag, level });
    }

    // Render list item inner content
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inner = ((el.paragraph.elements ?? []) as any[])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((e: any) => paraElementToHtml(e, ctx))
      .join('');
    html += `<li style="margin:0.1em 0;">${inner}</li>`;
    consumed++;
  }

  // Close remaining open tags
  while (stack.length > 0) {
    html += `</${stack.pop()!.tag}>`;
  }

  return { listHtml: html, consumed };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function paragraphToHtml(para: any, ctx: RenderContext): string {
  const paraStyle = para.paragraphStyle ?? {};
  const namedStyleType = (paraStyle.namedStyleType as string | undefined) ?? 'NORMAL_TEXT';

  // Resolve merged style: namedStyle base + paragraph overrides
  const namedBase = ctx.namedStyles[namedStyleType]?.paragraphStyle ?? {};

  const align = (paraStyle.alignment as string | undefined) ?? (namedBase.alignment as string | undefined);
  const alignCss = align === 'CENTER'    ? 'text-align:center;'
    : align === 'END'       ? 'text-align:right;'
    : align === 'JUSTIFIED' ? 'text-align:justify;'
    : 'text-align:left;';

  const css: string[] = [alignCss];

  // Apply font properties from the namedStyle so text runs that don't specify
  // their own size/family inherit the correct values (critical for headings).
  const namedTextStyle = ctx.namedStyles[namedStyleType]?.textStyle ?? {};
  const namedFontSizePt = namedTextStyle.fontSize?.magnitude as number | undefined;
  if (namedFontSizePt) css.push(`font-size:${namedFontSizePt}pt`);
  const namedFontFamily = namedTextStyle.weightedFontFamily?.fontFamily as string | undefined;
  if (namedFontFamily) css.push(`font-family:'${namedFontFamily}',sans-serif`);
  if (namedTextStyle.bold) css.push(`font-weight:bold`);

  // Reset heading-specific decorations that wrapWithPageLayout's TipTap CSS applies.
  // Without these, `.document h1 { text-transform:uppercase; letter-spacing:0.09em }` wins.
  if (namedStyleType.startsWith('HEADING_')) {
    css.push('text-transform:none', 'letter-spacing:normal');
  }

  // Always emit margin-top/margin-bottom (default 0) so the CSS class rule
  // `.document p { margin-bottom: 0.75em }` does not add unwanted spacing.
  const spaceAbovePt = (paraStyle.spaceAbove?.magnitude as number | undefined)
    ?? (namedBase.spaceAbove?.magnitude as number | undefined) ?? 0;
  css.push(`margin-top:${ptToCss(spaceAbovePt)}`);

  const spaceBelowPt = (paraStyle.spaceBelow?.magnitude as number | undefined)
    ?? (namedBase.spaceBelow?.magnitude as number | undefined) ?? 0;
  css.push(`margin-bottom:${ptToCss(spaceBelowPt)}`);

  // Always emit line-height (default 1.15 = Google Docs single spacing) so the
  // CSS body rule `line-height:1.75` does not over-expand text.
  const lineSpacing = (paraStyle.lineSpacing as number | undefined)
    ?? (namedBase.lineSpacing as number | undefined) ?? 115;
  css.push(`line-height:${(lineSpacing / 100).toFixed(2)}`);

  const indentStartPt = (paraStyle.indentStart?.magnitude as number | undefined)
    ?? (namedBase.indentStart?.magnitude as number | undefined);
  if (indentStartPt) css.push(`padding-left:${ptToCss(indentStartPt)}`);

  const indentFirstLinePt = (paraStyle.indentFirstLine?.magnitude as number | undefined)
    ?? (namedBase.indentFirstLine?.magnitude as number | undefined);
  if (indentFirstLinePt) css.push(`text-indent:${ptToCss(indentFirstLinePt)}`);

  // Positioned images (floating/anchored), rendered before paragraph text
  const positionedImgs = ((para.positionedObjectIds ?? []) as string[])
    .map((id) => {
      const src = ctx.imageCache[id];
      if (!src) return '';
      const embeddedObj = ctx.positionedObjects[id]?.positionedObjectProperties?.embeddedObject;
      const wPt = embeddedObj?.size?.width?.magnitude  as number | undefined;
      const hPt = embeddedObj?.size?.height?.magnitude as number | undefined;
      const sizeStyle = hPt ? `height:${hPt}pt;width:${wPt ? `${wPt}pt` : 'auto'};` : 'max-width:100%;';
      const marginStyle = align === 'CENTER'    ? 'margin-left:auto;margin-right:auto;'
        : align === 'END'       ? 'margin-left:auto;margin-right:0;'
        : 'margin-left:0;margin-right:auto;';
      return `<div style="width:100%;padding:0;"><img src="${src}" style="${sizeStyle}display:block;${marginStyle}" /></div>`;
    })
    .join('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inner = ((para.elements ?? []) as any[])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((el: any) => paraElementToHtml(el, ctx))
    .join('');

  const styleAttr = ` style="${css.join(';')}"`;

  if (namedStyleType === 'HEADING_1') return `${positionedImgs}<h1${styleAttr}>${inner}</h1>`;
  if (namedStyleType === 'HEADING_2') return `${positionedImgs}<h2${styleAttr}>${inner}</h2>`;
  if (namedStyleType === 'HEADING_3') return `${positionedImgs}<h3${styleAttr}>${inner}</h3>`;
  if (namedStyleType === 'HEADING_4') return `${positionedImgs}<h4${styleAttr}>${inner}</h4>`;
  if (namedStyleType === 'HEADING_5') return `${positionedImgs}<h5${styleAttr}>${inner}</h5>`;
  if (namedStyleType === 'HEADING_6') return `${positionedImgs}<h6${styleAttr}>${inner}</h6>`;

  if (!inner.trim()) return positionedImgs ? positionedImgs : '<p></p>';
  return `${positionedImgs}<p${styleAttr}>${inner}</p>`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function paraElementToHtml(el: any, ctx: RenderContext): string {
  if (el.pageBreak) return '<span style="page-break-after:always;display:block;"></span>';
  if (el.horizontalRule) return '<hr />';

  if (el.inlineObjectElement) {
    const id  = el.inlineObjectElement.inlineObjectId as string;
    const src = ctx.imageCache[id];
    if (!src) return '';
    const embeddedObj = ctx.inlineObjects[id]?.inlineObjectProperties?.embeddedObject;
    const wPt = embeddedObj?.size?.width?.magnitude  as number | undefined;
    const hPt = embeddedObj?.size?.height?.magnitude as number | undefined;
    const sizeStyle = (wPt && hPt)
      ? `width:${wPt}pt;height:${hPt}pt;`
      : 'max-width:100%;';
    return `<img src="${src}" style="${sizeStyle}vertical-align:middle;" />`;
  }

  if (el.textRun) {
    const tr  = el.textRun;
    let text: string = (tr.content as string) ?? '';
    // Eliminar el salto de línea final que Docs añade a cada párrafo
    text = text.replace(/\n$/, '');
    if (!text) return '';

    // Escapar HTML preservando llaves dobles de variables ({{VAR}})
    text = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const ts = tr.textStyle ?? {};
    const css: string[] = [];

    const fontSize = ts.fontSize?.magnitude as number | undefined;
    if (fontSize) css.push(`font-size:${fontSize}pt`);

    const fontFamily = ts.weightedFontFamily?.fontFamily as string | undefined;
    if (fontFamily) css.push(`font-family:'${fontFamily}',sans-serif`);

    const fgRgb = ts.foregroundColor?.color?.rgbColor;
    if (fgRgb) {
      // Skip default black (all zero fields)
      const isBlack = !(fgRgb.red || fgRgb.green || fgRgb.blue);
      if (!isBlack) css.push(`color:${rgbToCss(fgRgb)}`);
    }

    const bgRgb = ts.backgroundColor?.color?.rgbColor;
    if (bgRgb) {
      // Skip transparent (all zero / missing)
      const isTransparent = !(bgRgb.red || bgRgb.green || bgRgb.blue);
      if (!isTransparent) css.push(`background-color:${rgbToCss(bgRgb)}`);
    }

    const decorations: string[] = [];
    if (ts.underline && !ts.link) decorations.push('underline');
    if (ts.strikethrough) decorations.push('line-through');
    if (decorations.length) css.push(`text-decoration:${decorations.join(' ')}`);

    const baseline = ts.baselineOffset as string | undefined;
    if (baseline === 'SUPERSCRIPT') css.push('vertical-align:super;font-size:0.75em');
    if (baseline === 'SUBSCRIPT')   css.push('vertical-align:sub;font-size:0.75em');

    if (css.length) text = `<span style="${css.join(';')}">${text}</span>`;

    if (ts.bold)   text = `<strong>${text}</strong>`;
    if (ts.italic) text = `<em>${text}</em>`;
    if (ts.link?.url) {
      text = `<a href="${ts.link.url as string}" target="_blank" rel="noopener" style="color:inherit;">${text}</a>`;
    }

    return text;
  }

  return '';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tableToHtml(table: any, ctx: RenderContext): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = table.tableRows ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rowsHtml = rows.map((row: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cells: any[] = row.tableCells ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return '<tr>' + cells.map((cell: any) =>
      `<td style="border:1px solid #ccc;padding:4px 8px;vertical-align:top;">${contentToHtml(cell.content ?? [], ctx)}</td>`
    ).join('') + '</tr>';
  }).join('');
  return `<table style="border-collapse:collapse;width:100%;margin:0.5em 0;">${rowsHtml}</table>`;
}
