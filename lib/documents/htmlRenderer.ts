/**
 * htmlRenderer.ts
 *
 * Handles variable substitution and HTML layout wrapping for document templates.
 *
 * Variable syntax: {variable_name}
 * Supports nested dot notation in the input data map, e.g.:
 *   data = { 'client_name': 'Juan Pérez', 'document_number': '12345678' }
 */

// ─── Variable resolution ───────────────────────────────────────────────────────

/**
 * Replaces every {variable_name} token in `template` with the
 * corresponding value from `data`.
 *
 * Unknown tokens are left as-is so the caller can detect them via
 * `getUnresolvedVars()`.
 */
export function substituteVars(
  template: string,
  data: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(data, key)) return match;
    const value = data[key] ?? '';
    if (isImageUrl(value)) {
      return `<img src="${value}" alt="" style="max-height:56px;max-width:180px;object-fit:contain;vertical-align:middle;display:inline-block;" />`;
    }
    return value;
  });
}

function isImageUrl(value: string): boolean {
  if (!value) return false;
  if (value.startsWith('data:image')) return true;
  return (value.startsWith('http') || value.startsWith('/')) &&
    /\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(value);
}

/**
 * Returns the list of {{variable_name}} tokens that remain unresolved
 * after substitution (i.e. keys present in the template but absent in data).
 */
export function getUnresolvedVars(template: string, data: Record<string, string>): string[] {
  const tokens = [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  const unique  = [...new Set(tokens)];
  return unique.filter((key) => !Object.prototype.hasOwnProperty.call(data, key));
}

/**
 * Validates that all variables declared in the template's `variables` manifest
 * and marked `required: true` are present in `data`.
 *
 * Returns an array of missing variable names (empty array = valid).
 */
export function validateRequiredVars(
  variables: Array<{ name: string; label: string; required?: boolean }>,
  data: Record<string, string>,
): string[] {
  return variables
    .filter((v) => v.required && !Object.prototype.hasOwnProperty.call(data, v.name))
    .map((v) => v.label || v.name);
}

// ─── HTML page wrapper ─────────────────────────────────────────────────────────

// ─── Header / Footer content rendering ────────────────────────────────────────

interface SideContent {
  image?: { url: string; alignment: 'left' | 'center' | 'right' } | null;
  text?: unknown; // TipTap JSON — rendered by caller if needed
}

/**
 * Converts the `content` JSON from a document_headers / document_footers row
 * to a plain HTML fragment (no page wrapper, no TipTap text rendering).
 *
 * The `text` field (TipTap JSON) is intentionally excluded here because
 * converting it requires @tiptap/html which must not be imported in this module
 * (it would pull TipTap into every client bundle that imports htmlRenderer).
 * Pass pre-rendered `textHtml` via the options parameter instead.
 */
export function renderHeaderFooterHtml(
  content: unknown,
  position: 'header' | 'footer',
  textHtml = '',
): string {
  const c = content as SideContent | null;
  const prefix = `template-${position}`;
  const parts: string[] = [];

  const imageHtml = c?.image?.url
    ? `<div class="${prefix}-img-${c.image.alignment ?? 'left'}">` +
      `<img src="${c.image.url}" alt="" /></div>`
    : '';

  const textBlock = textHtml ? `<div class="${prefix}-text">${textHtml}</div>` : '';

  if (position === 'header') {
    if (imageHtml) parts.push(imageHtml);
    if (textBlock) parts.push(textBlock);
  } else {
    if (textBlock) parts.push(textBlock);
    if (imageHtml) parts.push(imageHtml);
  }

  return parts.join('\n');
}

// ─── Puppeteer header / footer templates ──────────────────────────────────────

/**
 * CSS embedded in Puppeteer header/footer templates.
 * These templates are rendered in an isolated frame — no external stylesheets apply,
 * so all styles must be inlined here. Padding matches the document's @page margins.
 */
const PUPPETEER_HF_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-size: 0; }
  .hf-wrap {
    display: block;
    width: 100%;
    padding: 4px 3cm;
    font-size: 9pt;
    font-family: Inter, Arial, Helvetica, sans-serif;
    color: #444;
    line-height: 1.4;
  }
  .hf-wrap.hf-header { }
  .hf-wrap.hf-footer { }
  .template-header-img-left,  .template-footer-img-left  { text-align: left;   margin-bottom: 3px; }
  .template-header-img-center,.template-footer-img-center { text-align: center; margin-bottom: 3px; }
  .template-header-img-right, .template-footer-img-right  { text-align: right;  margin-bottom: 3px; }
  img { max-height: 36px; max-width: 160px; object-fit: contain; display: inline-block; }
  p { margin-bottom: 0.15em; font-size: 8.5pt; }
  strong { font-weight: bold; }
  em { font-style: italic; }
`;

/**
 * Wraps the pre-rendered header HTML fragment in a self-contained Puppeteer
 * headerTemplate (with embedded CSS). The template is rendered in an isolated
 * frame on every PDF page — within the top @page margin area.
 */
export function buildPuppeteerHeaderTemplate(headerHtml: string): string {
  return `<style>${PUPPETEER_HF_CSS}</style><div class="hf-wrap hf-header">${headerHtml}</div>`;
}

/**
 * Wraps the pre-rendered footer HTML fragment in a self-contained Puppeteer
 * footerTemplate (with embedded CSS). The template is rendered in an isolated
 * frame on every PDF page — within the bottom @page margin area.
 */
export function buildPuppeteerFooterTemplate(footerHtml: string): string {
  return `<style>${PUPPETEER_HF_CSS}</style><div class="hf-wrap hf-footer">${footerHtml}</div>`;
}

export interface PageLayoutOptions {
  /** Pre-rendered HTML for the document header (from document_headers table) */
  headerHtml?: string;
  /** Pre-rendered HTML for the document footer (from document_footers table) */
  footerHtml?: string;
}

/**
 * Wraps a template body fragment in a complete HTML document with embedded
 * legal-document CSS optimised for A4 PDF output (Puppeteer + @page rules).
 */
export function wrapWithPageLayout(
  bodyHtml: string,
  title = 'Documento Legal',
  options: PageLayoutOptions = {},
): string {
  const { headerHtml, footerHtml } = options;
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    /* ── Fonts ──────────────────────────────────────── */
    @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300;0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;1,14..32,400&display=swap');

    /* ── Reset ─────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Page setup ─────────────────────────────────── */
    @page {
      size: A4;
      margin: 2.5cm 3cm 2.5cm 3cm;
    }

    html, body {
      width: 21cm;
      background: #ffffff;
      color: #1a1a1a;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      font-size: 11pt;
      line-height: 1.75;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── Document container ──────────────────────────── */
    .document {
      width: 100%;
      min-height: 24cm;
      padding: 0;
    }

    /* ── Template header / footer ────────────────────── */
    .template-header {
      margin-bottom: 24px;
      padding-bottom: 14px;
    }

    .template-header-img-left  { text-align: left;   margin-bottom: 8px; }
    .template-header-img-center { text-align: center; margin-bottom: 8px; }
    .template-header-img-right { text-align: right;  margin-bottom: 8px; }

    .template-header img,
    .template-footer img {
      max-height: 64px;
      max-width: 240px;
      object-fit: contain;
    }

    .template-header-text p,
    .template-footer-text p { margin-bottom: 0.25em; font-size: 9.5pt; color: #444; }

    .template-footer {
      margin-top: 40px;
      padding-top: 10px;
      font-size: 9pt;
      color: #666;
    }

    .template-footer-img-left  { text-align: left;   margin-top: 8px; }
    .template-footer-img-center { text-align: center; margin-top: 8px; }
    .template-footer-img-right { text-align: right;  margin-top: 8px; }

    /* ── Title ──────────────────────────────────────── */
    .document-title {
      text-align: center;
      font-size: 14pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 3px;
      border-top: 1px solid #333;
      border-bottom: 1px solid #333;
      padding: 10px 0;
      margin: 0 0 28px 0;
    }

    .document-subtitle {
      text-align: center;
      font-size: 10pt;
      font-style: italic;
      color: #555;
      margin-top: -20px;
      margin-bottom: 28px;
    }

    /* ── Body text ───────────────────────────────────── */
    .content p {
      text-align: justify;
      margin-bottom: 14px;
      text-indent: 2em;
    }

    .content p:first-child { text-indent: 0; }

    /* ── Clauses ─────────────────────────────────────── */
    .clause {
      margin-bottom: 20px;
    }

    .clause-number {
      font-weight: bold;
      font-size: 10pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .clause-title {
      font-weight: bold;
      display: inline;
    }

    /* ── Highlighted boxes ───────────────────────────── */
    .info-box {
      background: #f5f5f5;
      border-left: 3px solid #333;
      padding: 12px 16px;
      margin: 16px 0;
      font-size: 10.5pt;
    }

    .info-box p { text-indent: 0; margin-bottom: 6px; }
    .info-box p:last-child { margin-bottom: 0; }

    /* ── Signature section ───────────────────────────── */
    .signatures {
      margin-top: 56px;
      display: flex;
      justify-content: space-around;
      gap: 40px;
      page-break-inside: avoid;
    }

    .signature-block {
      flex: 1;
      text-align: center;
      max-width: 220px;
    }

    .sig-space { height: 64px; }

    .sig-line {
      border-top: 1px solid #1a1a1a;
      margin-bottom: 8px;
    }

    .sig-name {
      font-weight: bold;
      font-size: 10.5pt;
    }

    .sig-label {
      font-size: 9.5pt;
      color: #555;
      margin-top: 2px;
    }

    /* Signature image (pre-uploaded by the lawyer) */
    .sig-space img {
      display: block;
      margin: 0 auto;
    }

    /* ── Footer ──────────────────────────────────────── */
    .doc-footer {
      margin-top: 48px;
      border-top: 1px solid #ccc;
      padding-top: 10px;
      font-size: 8.5pt;
      color: #888;
      text-align: center;
      page-break-inside: avoid;
    }

    /* ── Print helpers ───────────────────────────────── */
    .page-break { page-break-before: always; }
    .no-break   { page-break-inside: avoid; }

    strong { font-weight: bold; }
    em     { font-style: italic; }

    /* ── TipTap-generated elements ───────────────────── */
    /* Heading scale: base 11pt → same em ratios used in the editor (base 16px) */
    .document h1 { font-size: 1.636em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.09em; text-align: center; margin: 1.2em 0 0.6em; line-height: 1.3; }
    .document h2 { font-size: 1.273em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin: 1em 0 0.5em; line-height: 1.35; }
    .document h3 { font-size: 1.091em; font-weight: 600; margin: 0.9em 0 0.4em; line-height: 1.4; }
    .document h4 { font-size: 1em;     font-weight: 600; margin: 0.8em 0 0.4em; }
    .document h5, .document h6 { font-size: 0.955em; font-weight: 600; margin: 0.7em 0 0.3em; }

    .document p { margin-bottom: 0.75em; line-height: 1.75; text-align: justify; }
    .document p:empty,
    .document p:has(> br:only-child) { min-height: 1.75em; margin-bottom: 0; }

    .document ul, .document ol { margin: 0.5em 0 0.75em 2em; padding: 0; }
    .document ul { list-style-type: disc; }
    .document ol { list-style-type: decimal; }
    .document li { margin-bottom: 0.3em; line-height: 1.65; }

    .document blockquote {
      border-left: 3px solid #555;
      margin: 1em 0 1em 1em;
      padding: 0.5em 1em;
      color: #444;
      font-style: italic;
    }

    .document table {
      width: 100%;
      border-collapse: collapse;
      margin: 1em 0;
      font-size: 10.5pt;
    }
    .document th, .document td {
      border: 1px solid #999;
      padding: 6px 10px;
      text-align: left;
      vertical-align: top;
    }
    .document th { background: #f0f0f0; font-weight: bold; }

    .document code {
      font-family: 'Courier New', monospace;
      font-size: 9.5pt;
      background: #f5f5f5;
      padding: 1px 4px;
      border-radius: 2px;
    }
    .document pre {
      background: #f5f5f5;
      padding: 12px 16px;
      margin: 0.75em 0;
      border-radius: 4px;
      overflow-x: auto;
      font-family: 'Courier New', monospace;
      font-size: 9.5pt;
    }

    .document hr {
      border: none;
      border-top: 1px solid #ccc;
      margin: 1.5em 0;
    }

    /* TipTap text-align attributes */
    .document [style*="text-align: center"], .document .text-center { text-align: center; }
    .document [style*="text-align: right"],  .document .text-right  { text-align: right; }
    .document [style*="text-align: justify"],.document .text-justify { text-align: justify; }

    /* TipTap two-column layout */
    .document [data-type="two-column"] { display: flex; gap: 20px; margin: 0.75em 0; }
    .document [data-type="column"] { flex: 1; min-width: 0; }
  </style>
</head>
<body>
  <div class="document">
    ${headerHtml ? `<div class="template-header">${headerHtml}</div>` : ''}
    ${bodyHtml}
    ${footerHtml ? `<div class="template-footer">${footerHtml}</div>` : ''}
  </div>
</body>
</html>`;
}

// ─── Utility ───────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
