import { generateHTML } from '@tiptap/html';
import { Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import {
  getImageBoxStyle,
  getImageOuterStyle,
  normalizeImageAlign,
  normalizeImageLayout,
  parseImageWidth,
  styleObjectToString,
} from '@/lib/tiptap/image-layout';

const ImageExtensionServer = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '' },
      width: { default: 50 },
      align: { default: 'center' },
      layout: { default: 'inline' },
    };
  },
  parseHTML() { return [{ tag: 'img[src]' }]; },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    const width = parseImageWidth(HTMLAttributes.width);
    const align = normalizeImageAlign(HTMLAttributes.align);
    const layout = normalizeImageLayout(HTMLAttributes.layout, Boolean(HTMLAttributes.layout));
    const outerStyle = styleObjectToString(getImageOuterStyle({ width, align, layout }));
    const boxStyle = styleObjectToString(getImageBoxStyle({ width, align, layout }));

    return [
      'div',
      {
        'data-image-wrap': 'true',
        'data-align': align,
        'data-layout': layout,
        'data-width': String(width),
        style: outerStyle,
      },
      [
        'div',
        { 'data-image-box': 'true', style: boxStyle },
        [
          'img',
          {
            src: HTMLAttributes.src,
            alt: HTMLAttributes.alt ?? '',
            style: 'width:100%;max-width:100%;display:block;border-radius:2px',
          },
        ],
      ],
    ];
  },
});

export function tiptapToHTML(content: unknown) {
  return generateHTML(content as import('@tiptap/core').JSONContent, [
    StarterKit,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ImageExtensionServer,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ] as any);
}
