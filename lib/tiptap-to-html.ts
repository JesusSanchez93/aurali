import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';

export function tiptapToHTML(content: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return generateHTML(content, [StarterKit, TextAlign.configure({ types: ['heading', 'paragraph'] })] as any);
}
