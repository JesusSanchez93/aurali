import { useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import { Button } from '../ui/button';
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Italic,
  List,
  ListOrdered,
  Pilcrow,
  Strikethrough,
  AlignLeft,
  AlignRight,
  AlignCenter,
} from 'lucide-react';

function MenuBar({ editor }: { editor: Editor }) {
  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      return {
        isBold: ctx.editor.isActive('bold') ?? false,
        canBold: ctx.editor.can().chain().toggleBold().run() ?? false,
        isItalic: ctx.editor.isActive('italic') ?? false,
        canItalic: ctx.editor.can().chain().toggleItalic().run() ?? false,
        isStrike: ctx.editor.isActive('strike') ?? false,
        canStrike: ctx.editor.can().chain().toggleStrike().run() ?? false,
        isCode: ctx.editor.isActive('code') ?? false,
        canCode: ctx.editor.can().chain().toggleCode().run() ?? false,
        canClearMarks: ctx.editor.can().chain().unsetAllMarks().run() ?? false,
        isParagraph: ctx.editor.isActive('paragraph') ?? false,
        isHeading1: ctx.editor.isActive('heading', { level: 1 }) ?? false,
        isHeading2: ctx.editor.isActive('heading', { level: 2 }) ?? false,
        isHeading3: ctx.editor.isActive('heading', { level: 3 }) ?? false,
        isHeading4: ctx.editor.isActive('heading', { level: 4 }) ?? false,
        isHeading5: ctx.editor.isActive('heading', { level: 5 }) ?? false,
        isHeading6: ctx.editor.isActive('heading', { level: 6 }) ?? false,
        isBulletList: ctx.editor.isActive('bulletList') ?? false,
        isOrderedList: ctx.editor.isActive('orderedList') ?? false,
        isCodeBlock: ctx.editor.isActive('codeBlock') ?? false,
        isBlockquote: ctx.editor.isActive('blockquote') ?? false,
        canUndo: ctx.editor.can().chain().undo().run() ?? false,
        canRedo: ctx.editor.can().chain().redo().run() ?? false,
      };
    },
  });

  return (
    <div className="sticky top-[var(--header-height)] z-10 rounded-t-md border-b bg-background/80 p-1 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className={'flex flex-wrap gap-2'}>
        <Button
          variant={editorState.isBold ? 'secondary' : 'ghost'}
          size="icon"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editorState.canBold}
        >
          <Bold />
        </Button>
        <Button
          variant={editorState.isItalic ? 'secondary' : 'ghost'}
          size="icon"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editorState.canItalic}
        >
          <Italic />
        </Button>
        <Button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editorState.canStrike}
          variant={editorState.isStrike ? 'secondary' : 'ghost'}
          size="icon"
        >
          <Strikethrough />
        </Button>
        <Button
          onClick={() => editor.chain().focus().toggleCode().run()}
          disabled={!editorState.canCode}
          variant={editorState.isCode ? 'secondary' : 'ghost'}
          size="icon"
        >
          <Code />
        </Button>
        <Button
          onClick={() => editor.chain().focus().setParagraph().run()}
          variant={editorState.isParagraph ? 'secondary' : 'ghost'}
          size="icon"
        >
          <Pilcrow />
        </Button>
        <Button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          variant={editorState.isHeading1 ? 'secondary' : 'ghost'}
          size="icon"
        >
          <Heading1 />
        </Button>
        <Button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          variant={editorState.isHeading2 ? 'secondary' : 'ghost'}
          size="icon"
        >
          <Heading2 />
        </Button>
        <Button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          variant={editorState.isHeading3 ? 'secondary' : 'ghost'}
          size="icon"
        >
          <Heading3 />
        </Button>
        <Button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 4 }).run()
          }
          variant={editorState.isHeading4 ? 'secondary' : 'ghost'}
          size="icon"
        >
          <Heading4 />
        </Button>
        <Button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 5 }).run()
          }
          variant={editorState.isHeading5 ? 'secondary' : 'ghost'}
          size="icon"
        >
          <Heading5 />
        </Button>
        <Button
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 6 }).run()
          }
          variant={editorState.isHeading6 ? 'secondary' : 'ghost'}
          size="icon"
        >
          <Heading6 />
        </Button>
        <Button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          variant={editorState.isBulletList ? 'secondary' : 'ghost'}
          size="icon"
        >
          <List />
        </Button>
        <Button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          variant={editorState.isOrderedList ? 'secondary' : 'ghost'}
          size="icon"
        >
          <ListOrdered />
        </Button>
        <Button
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          variant={
            editor.isActive({ textAlign: 'left' }) ? 'secondary' : 'ghost'
          }
          size="icon"
        >
          <AlignLeft />
        </Button>
        <Button
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          variant={
            editor.isActive({ textAlign: 'center' }) ? 'secondary' : 'ghost'
          }
          size="icon"
        >
          <AlignCenter />
        </Button>
        <Button
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          variant={
            editor.isActive({ textAlign: 'right' }) ? 'secondary' : 'ghost'
          }
          size="icon"
        >
          <AlignRight />
        </Button>
      </div>
    </div>
  );
}

export { MenuBar };
