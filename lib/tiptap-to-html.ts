import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';

export function tiptapToHTML(content: any) {
  return generateHTML(content, [StarterKit]);
}
