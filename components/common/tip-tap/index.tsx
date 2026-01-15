import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { MenuBar } from './menu-bar';
import TextAlign from '@tiptap/extension-text-align';

const extensions = [
  TextStyleKit,
  StarterKit,
  TextAlign.configure({
    types: ['heading', 'paragraph'],
  }),
];

interface Props {
  value?: any;
  onChange: (value: any) => void;
}

export default function Tiptap({ value, onChange }: Props) {
  const editor = useEditor({
    extensions,
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getJSON());
    },
    // Don't render immediately on the server to avoid SSR issues
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'min-h-[150px] px-3 py-2 prose max-w-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0',
      },
    },
  });

  return (
    <div className="flex flex-col gap-2 rounded-md border border-input bg-background text-sm">
      {editor && <MenuBar editor={editor} />}
      <div>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
