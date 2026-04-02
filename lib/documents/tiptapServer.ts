/**
 * tiptapServer.ts
 *
 * Server-side TipTap JSON → HTML conversion.
 * Isolated from generateDocument.ts / pdfGenerator.ts so that Turbopack
 * can load this module without pulling in Puppeteer or other heavy deps
 * that confuse the RSC module graph.
 */

import { generateHTML } from '@tiptap/html/server';
import { Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { wrapWithPageLayout, type PageLayoutOptions } from './htmlRenderer';

// ─── Server-safe custom extensions (no React / NodeView) ──────────────────────

const SignatureExtensionServer = Node.create({
  name: 'signature',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      name:   { default: '' },
      role:   { default: '' },
      signed: { default: false },
      image:  { default: null },
      date:   { default: null },
    };
  },
  parseHTML() { return [{ tag: 'div[data-type="signature"]' }]; },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    const nameStr = typeof HTMLAttributes.name === 'string' ? HTMLAttributes.name : '';
    const roleStr = typeof HTMLAttributes.role === 'string' ? HTMLAttributes.role : '';
    const imgSrc  = typeof HTMLAttributes.image === 'string' &&
      (HTMLAttributes.image.startsWith('http') || HTMLAttributes.image.startsWith('data:'))
        ? HTMLAttributes.image
        : null;
    const sigArea = imgSrc
      ? ['div', { class: 'sig-space', style: 'text-align:center;' },
          ['img', { src: imgSrc, alt: 'Firma', style: 'max-height:56px;max-width:100%;object-fit:contain;' }],
        ]
      : ['div', { class: 'sig-space' }];
    return ['div', { class: 'signature-block', 'data-type': 'signature' },
      sigArea,
      ['div', { class: 'sig-line' }],
      ['p', { class: 'sig-name' }, nameStr],
      ['p', { class: 'sig-label' }, roleStr],
    ];
  },
});

const SignatureRowExtensionServer = Node.create({
  name: 'signatureRow',
  group: 'block',
  content: 'signature{2}',
  parseHTML() { return [{ tag: 'div[data-type="signature-row"]' }]; },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'signatures', 'data-type': 'signature-row' }), 0];
  },
});

const ColumnExtensionServer = Node.create({
  name: 'column',
  group: 'block',
  content: 'block+',
  isolating: true,
  parseHTML() { return [{ tag: 'div[data-type="column"]' }]; },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'column', style: 'flex:1;min-width:0;' }), 0];
  },
});

const TwoColumnExtensionServer = Node.create({
  name: 'twoColumn',
  group: 'block',
  content: 'column{2}',
  parseHTML() { return [{ tag: 'div[data-type="two-column"]' }]; },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'two-column', style: 'display:flex;gap:20px;' }), 0];
  },
});

const VariableNodeServer = Node.create({
  name: 'variable',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return { variable: { default: '' } };
  },
  parseHTML() { return [{ tag: 'span[data-variable]' }]; },
  renderHTML({ node }) {
    return ['span', { 'data-variable': node.attrs['variable'] }, `{${node.attrs['variable']}}`];
  },
});

const ImageExtensionServer = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      src:   { default: null },
      alt:   { default: '' },
      width: { default: null },
      align: { default: 'block' },
    };
  },
  parseHTML() { return [{ tag: 'img[src]' }]; },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    const style = HTMLAttributes.align === 'left'
      ? 'float:left;margin-right:16px;'
      : HTMLAttributes.align === 'right'
        ? 'float:right;margin-left:16px;'
        : 'display:block;margin:0 auto;';
    const attrs: Record<string, unknown> = {
      src: HTMLAttributes.src,
      alt: HTMLAttributes.alt ?? '',
      style,
    };
    if (HTMLAttributes.width) attrs.width = HTMLAttributes.width;
    return ['img', attrs];
  },
});

const TIPTAP_EXTENSIONS = [
  StarterKit,
  TextStyle,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  SignatureExtensionServer,
  SignatureRowExtensionServer,
  ColumnExtensionServer,
  TwoColumnExtensionServer,
  VariableNodeServer,
  ImageExtensionServer,
  Table.configure({ resizable: false }),
  TableRow,
  TableCell,
  TableHeader,
];

/**
 * Converts TipTap JSON content to a full HTML document.
 * Safe to call from Server Actions — no Puppeteer or PDF deps.
 */
export function tiptapJsonToHtml(
  content: unknown,
  templateName: string,
  options: PageLayoutOptions = {},
): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bodyHtml = generateHTML(content as any, TIPTAP_EXTENSIONS as any);
  return wrapWithPageLayout(bodyHtml, templateName, options);
}

/**
 * Converts TipTap JSON to raw body HTML without the page wrapper.
 * Use when you need to substitute variables or inject header/footer before wrapping.
 */
export function tiptapJsonToBodyHtml(content: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return generateHTML(content as any, TIPTAP_EXTENSIONS as any);
}
