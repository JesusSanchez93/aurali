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
    return Object.prototype.hasOwnProperty.call(data, key) ? (data[key] ?? '') : match;
  });
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

/**
 * Wraps a template body fragment in a complete HTML document with embedded
 * legal-document CSS optimised for A4 PDF output (Puppeteer + @page rules).
 */
export function wrapWithPageLayout(bodyHtml: string, title = 'Documento Legal'): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
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
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.9;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── Document container ──────────────────────────── */
    .document {
      width: 100%;
      min-height: 24cm;
      padding: 0;
    }

    /* ── Header ─────────────────────────────────────── */
    .doc-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      border-bottom: 2.5px solid #1a1a1a;
      padding-bottom: 14px;
      margin-bottom: 28px;
      gap: 20px;
    }

    .firm-name {
      font-size: 15pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      line-height: 1.3;
    }

    .firm-subtitle {
      font-size: 9.5pt;
      color: #444;
      margin-top: 3px;
      font-style: italic;
    }

    .doc-meta {
      text-align: right;
      font-size: 9.5pt;
      color: #555;
      white-space: nowrap;
    }

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
    .document h1 { font-size: 18pt; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; text-align: center; margin: 1.2em 0 0.6em; }
    .document h2 { font-size: 14pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin: 1em 0 0.5em; }
    .document h3 { font-size: 12pt; font-weight: bold; margin: 0.9em 0 0.4em; }
    .document h4 { font-size: 11pt; font-weight: bold; margin: 0.8em 0 0.4em; }
    .document h5, .document h6 { font-size: 10.5pt; font-weight: bold; margin: 0.7em 0 0.3em; }

    .document p { margin-bottom: 0.75em; line-height: 1.9; text-align: justify; }

    .document ul, .document ol { margin: 0.5em 0 0.75em 2em; padding: 0; }
    .document ul { list-style-type: disc; }
    .document ol { list-style-type: decimal; }
    .document li { margin-bottom: 0.3em; line-height: 1.7; }

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
    ${bodyHtml}
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
