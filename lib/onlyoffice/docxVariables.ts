/**
 * docxVariables.ts
 *
 * Substitutes `{GROUP.TYPE}` (and `{AI_XXX}`) variable tokens directly in a
 * .docx file's XML parts, without depending on docxtemplater (dual AGPL /
 * commercial license — avoided for this proprietary SaaS).
 *
 * Word frequently splits a single visual run of text (e.g. "{CLIENT.NAME}")
 * across multiple <w:t> elements — every time spell-check, autocorrect, or a
 * formatting boundary touches the text. A naive string replace on the raw XML
 * misses these split tokens. Instead we flatten all <w:t> text in a part into
 * one string, match variable tokens against the flattened text, then map each
 * match back to the runs it spans and edit them in place.
 */

import JSZip from 'jszip';

const VARIABLE_PATTERN = /\{([A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)?)\}/g;

interface TextRun {
  contentStart: number;
  contentEnd: number;
  text: string;
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function encodeXmlEntities(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function findTextRuns(xml: string): TextRun[] {
  const runs: TextRun[] = [];
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const fullStart = m.index;
    const openTagLen = m[0].indexOf('>') + 1;
    runs.push({
      contentStart: fullStart + openTagLen,
      contentEnd: fullStart + m[0].length - '</w:t>'.length,
      text: decodeXmlEntities(m[1]),
    });
  }
  return runs;
}

function applyEditsToRunText(original: string, edits: Edit[]): string {
  if (edits.length === 0) return original;
  const sorted = [...edits].sort((a, b) => a.start - b.start);
  let result = '';
  let cursor = 0;
  for (const e of sorted) {
    result += original.slice(cursor, e.start);
    result += e.text;
    cursor = e.end;
  }
  result += original.slice(cursor);
  return result;
}

/** Substitutes variable tokens in a single XML part (document.xml, headerN.xml, footerN.xml). */
export function substituteDocxXml(xml: string, data: Record<string, string>): string {
  const runs = findTextRuns(xml);
  if (runs.length === 0) return xml;

  const runStarts: number[] = [];
  let cum = 0;
  for (const r of runs) {
    runStarts.push(cum);
    cum += r.text.length;
  }
  const flatText = runs.map((r) => r.text).join('');

  const runEdits: Edit[][] = runs.map(() => []);

  let match: RegExpExecArray | null;
  VARIABLE_PATTERN.lastIndex = 0;
  while ((match = VARIABLE_PATTERN.exec(flatText)) !== null) {
    const key = match[1];
    const value = Object.prototype.hasOwnProperty.call(data, key) ? data[key] : match[0];
    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;

    let firstOverlap = true;
    for (let i = 0; i < runs.length; i++) {
      const runStart = runStarts[i];
      const runEnd = runStart + runs[i].text.length;
      const overlapStart = Math.max(matchStart, runStart);
      const overlapEnd = Math.min(matchEnd, runEnd);
      if (overlapStart >= overlapEnd) continue;

      runEdits[i].push({
        start: overlapStart - runStart,
        end: overlapEnd - runStart,
        text: firstOverlap ? value : '',
      });
      firstOverlap = false;
    }
  }

  let result = xml;
  for (let i = runs.length - 1; i >= 0; i--) {
    const edits = runEdits[i];
    if (edits.length === 0) continue;
    const newText = encodeXmlEntities(applyEditsToRunText(runs[i].text, edits));
    result = result.slice(0, runs[i].contentStart) + newText + result.slice(runs[i].contentEnd);
  }
  return result;
}

/**
 * Substitutes `{GROUP.TYPE}` variables in a .docx buffer's body, headers, and
 * footers, and returns a new .docx buffer. Unresolved variables are left as
 * their original `{KEY}` token (same convention as the rest of the app).
 */
export async function substituteDocxVariables(
  fileBuffer: Buffer,
  data: Record<string, string>,
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(fileBuffer);
  const docXml = zip.file('word/document.xml');
  if (!docXml) {
    throw new Error('El archivo no es un .docx válido (falta word/document.xml).');
  }

  const bodyXml = await docXml.async('string');
  zip.file('word/document.xml', substituteDocxXml(bodyXml, data));

  const headerFooterNames = Object.keys(zip.files).filter((name) =>
    /^word\/(header|footer)\d*\.xml$/.test(name),
  );
  for (const name of headerFooterNames) {
    const partXml = await zip.file(name)!.async('string');
    zip.file(name, substituteDocxXml(partXml, data));
  }

  return zip.generateAsync({ type: 'nodebuffer' });
}

/**
 * Returns the concatenated plain text of a .docx's body + headers/footers.
 * Used to scan for `{AI_XXX}` tokens before resolving AI variables — cheaper
 * than round-tripping through substituteDocxVariables.
 */
export async function extractDocxPlainText(fileBuffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(fileBuffer);
  const parts = Object.keys(zip.files).filter((name) =>
    name === 'word/document.xml' || /^word\/(header|footer)\d*\.xml$/.test(name),
  );

  let text = '';
  for (const name of parts) {
    const xml = await zip.file(name)!.async('string');
    text += findTextRuns(xml).map((r) => r.text).join('');
  }
  return text;
}
