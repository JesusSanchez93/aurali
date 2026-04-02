import { Button } from '@/components/ui/button';
import { useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import type { Node } from '@tiptap/pm/model';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Table,
  Rows3,
  Columns3,
  Trash2,
  ChevronDown,
  PanelTop,
  PanelBottom,
  PanelLeft,
  PanelRight,
  LayoutTemplate,
  Image as ImageIcon,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';

// ─── Table header helpers ─────────────────────────────────────────────────────
function getTableInfo(editor: Editor) {
  const { state } = editor;
  const { schema } = state;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tableNode: any = null;
  let tablePos = -1;

  state.doc.descendants((node, pos) => {
    if (node.type.name === 'table') {
      tableNode = node;
      tablePos = pos;
      return false;
    }
  });

  return { tableNode: tableNode as Node | null, tablePos, schema };
}

function isFirstRowHeader(editor: Editor): boolean {
  const { tableNode, schema } = getTableInfo(editor);
  if (!tableNode || tableNode.childCount === 0) return false;
  const firstRow = tableNode.child(0);
  return firstRow.childCount > 0 && firstRow.child(0).type === schema.nodes.tableHeader;
}

function isLastRowHeader(editor: Editor): boolean {
  const { tableNode, schema } = getTableInfo(editor);
  if (!tableNode || tableNode.childCount === 0) return false;
  const lastRow = tableNode.child(tableNode.childCount - 1);
  return lastRow.childCount > 0 && lastRow.child(0).type === schema.nodes.tableHeader;
}

function isFirstColHeader(editor: Editor): boolean {
  const { tableNode, schema } = getTableInfo(editor);
  if (!tableNode || tableNode.childCount === 0) return false;
  return Array.from({ length: tableNode.childCount }, (_, i) => tableNode.child(i)).every(
    (row) => row.childCount > 0 && row.child(0).type === schema.nodes.tableHeader,
  );
}

function isLastColHeader(editor: Editor): boolean {
  const { tableNode, schema } = getTableInfo(editor);
  if (!tableNode || tableNode.childCount === 0) return false;
  return Array.from({ length: tableNode.childCount }, (_, i) => tableNode.child(i)).every(
    (row) => row.childCount > 0 && row.child(row.childCount - 1).type === schema.nodes.tableHeader,
  );
}

function toggleRowHeader(editor: Editor, rowIndex: 'first' | 'last') {
  const { tableNode, tablePos, schema } = getTableInfo(editor);
  if (!tableNode || tablePos === -1) return;

  const idx = rowIndex === 'first' ? 0 : tableNode.childCount - 1;
  const row = tableNode.child(idx);
  const isHeader = row.childCount > 0 && row.child(0).type === schema.nodes.tableHeader;
  const newType = isHeader ? schema.nodes.tableCell : schema.nodes.tableHeader;

  const { tr } = editor.state;
  let rowPos = tablePos + 1;
  for (let i = 0; i < idx; i++) rowPos += tableNode.child(i).nodeSize;

  let cellPos = rowPos + 1;
  for (let j = 0; j < row.childCount; j++) {
    tr.setNodeMarkup(cellPos, newType, row.child(j).attrs);
    cellPos += row.child(j).nodeSize;
  }
  editor.view.dispatch(tr);
}

function toggleColHeader(editor: Editor, colIndex: 'first' | 'last') {
  const { tableNode, tablePos, schema } = getTableInfo(editor);
  if (!tableNode || tablePos === -1) return;

  const isHeader =
    colIndex === 'first' ? isFirstColHeader(editor) : isLastColHeader(editor);
  const newType = isHeader ? schema.nodes.tableCell : schema.nodes.tableHeader;

  const { tr } = editor.state;
  let rowPos = tablePos + 1;

  for (let i = 0; i < tableNode.childCount; i++) {
    const row = tableNode.child(i);
    const j = colIndex === 'first' ? 0 : row.childCount - 1;
    let cellPos = rowPos + 1;
    for (let k = 0; k < j; k++) cellPos += row.child(k).nodeSize;
    tr.setNodeMarkup(cellPos, newType, row.child(j).attrs);
    rowPos += row.nodeSize;
  }
  editor.view.dispatch(tr);
}

// Deletes column then resets all colwidth attrs so the table refills the area
function deleteColumnAndRefit(editor: Editor) {
  editor.chain().focus().deleteColumn().run();
  const { state, view } = editor;
  const { tr, schema } = state;
  state.doc.descendants((node, pos) => {
    if (
      (node.type === schema.nodes.tableCell || node.type === schema.nodes.tableHeader) &&
      node.attrs.colwidth != null
    ) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, colwidth: null });
    }
  });
  if (tr.docChanged) view.dispatch(tr);
}

// ─── Table grid picker ────────────────────────────────────────────────────────
const GRID_COLS = 10;
const GRID_ROWS = 8;

function TableGridPicker({ onPick }: { onPick: (rows: number, cols: number) => void }) {
  const [hovered, setHovered] = useState<{ row: number; col: number } | null>(null);

  const activeRows = hovered ? hovered.row : 0;
  const activeCols = hovered ? hovered.col : 0;

  return (
    <div className="p-2">
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}
        onMouseLeave={() => setHovered(null)}
      >
        {Array.from({ length: GRID_ROWS * GRID_COLS }).map((_, i) => {
          const row = Math.floor(i / GRID_COLS) + 1;
          const col = (i % GRID_COLS) + 1;
          const active = row <= activeRows && col <= activeCols;
          return (
            <div
              key={i}
              className={`h-4 w-4 rounded-sm border transition-colors ${
                active
                  ? 'border-primary bg-primary/20'
                  : 'border-border bg-muted/40 hover:border-primary/50'
              }`}
              onMouseEnter={() => setHovered({ row, col })}
              onClick={() => onPick(row, col)}
            />
          );
        })}
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        {hovered ? `${hovered.col} × ${hovered.row}` : 'Selecciona un tamaño'}
      </p>
    </div>
  );
}

// ─── Table dropdown ───────────────────────────────────────────────────────────
function TableMenu({ editor }: { editor: Editor }) {
  const isInTable = editor.isActive('table');

  const firstRow = isInTable && isFirstRowHeader(editor);
  const lastRow  = isInTable && isLastRowHeader(editor);
  const firstCol = isInTable && isFirstColHeader(editor);
  const lastCol  = isInTable && isLastColHeader(editor);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={isInTable ? 'secondary' : 'ghost'}
          size="sm"
          className="h-8 gap-1 px-2"
        >
          <Table className="h-4 w-4" />
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto">
        {/* Grid picker */}
        <TableGridPicker
          onPick={(rows, cols) =>
            editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()
          }
        />

        {isInTable && (
          <>
            {/* Header position */}
            <DropdownMenuSeparator />
            <div className="px-2 py-1">
              <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Encabezado</p>
              <div className="flex gap-1">
                <Button
                  type="button" size="icon"
                  variant={firstRow ? 'secondary' : 'ghost'}
                  className="h-8 w-8"
                  title="Primera fila"
                  onClick={() => toggleRowHeader(editor, 'first')}
                >
                  <PanelTop className="h-4 w-4" />
                </Button>
                <Button
                  type="button" size="icon"
                  variant={lastRow ? 'secondary' : 'ghost'}
                  className="h-8 w-8"
                  title="Última fila"
                  onClick={() => toggleRowHeader(editor, 'last')}
                >
                  <PanelBottom className="h-4 w-4" />
                </Button>
                <Button
                  type="button" size="icon"
                  variant={firstCol ? 'secondary' : 'ghost'}
                  className="h-8 w-8"
                  title="Primera columna"
                  onClick={() => toggleColHeader(editor, 'first')}
                >
                  <PanelLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button" size="icon"
                  variant={lastCol ? 'secondary' : 'ghost'}
                  className="h-8 w-8"
                  title="Última columna"
                  onClick={() => toggleColHeader(editor, 'last')}
                >
                  <PanelRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <DropdownMenuSeparator />

            {/* Columns */}
            <DropdownMenuItem onSelect={() => editor.chain().focus().addColumnBefore().run()}>
              <Columns3 className="mr-2 h-4 w-4" />
              Columna antes
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => editor.chain().focus().addColumnAfter().run()}>
              <Columns3 className="mr-2 h-4 w-4" />
              Columna después
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => deleteColumnAndRefit(editor)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar columna
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Rows */}
            <DropdownMenuItem onSelect={() => editor.chain().focus().addRowBefore().run()}>
              <Rows3 className="mr-2 h-4 w-4" />
              Fila antes
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => editor.chain().focus().addRowAfter().run()}>
              <Rows3 className="mr-2 h-4 w-4" />
              Fila después
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => editor.chain().focus().deleteRow().run()}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar fila
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Delete table */}
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => editor.chain().focus().deleteTable().run()}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar tabla
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Image insertion menu ─────────────────────────────────────────────────────
function ImageMenu({ editor }: { editor: Editor }) {
  const [url, setUrl] = useState('');
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function insertImageNode(src: string) {
    editor.chain().focus().insertContent({
      type: 'image',
      attrs: { src, width: 50, align: 'block' },
    }).run();
  }

  function handleInsertUrl() {
    if (!url.trim()) return;
    insertImageNode(url.trim());
    setUrl('');
    setOpen(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      if (src) {
        insertImageNode(src);
        setOpen(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" type="button" title="Insertar imagen">
            <ImageIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <div className="space-y-2 p-2">
            <p className="text-[11px] font-medium text-muted-foreground">Insertar imagen</p>
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleInsertUrl(); }}
                className="h-8 flex-1 rounded-md border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
              />
              <Button
                type="button"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={handleInsertUrl}
                disabled={!url.trim()}
              >
                OK
              </Button>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] text-muted-foreground">o</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-full text-xs"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Subir desde archivo
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  );
}

// ─── Main menu bar ────────────────────────────────────────────────────────────
interface PageSizeOption { value: string; label: string; }
interface PageSizeProps { value: string; options: PageSizeOption[]; onChange: (v: string) => void; }

function MenuBar({ editor, pageSizeProps, stickyTop }: { editor: Editor; pageSizeProps?: PageSizeProps; stickyTop?: string }) {
  const editorState = useEditorState({
    editor,
    selector: (ctx) => ({
      isBold: ctx.editor.isActive('bold') ?? false,
      canBold: ctx.editor.can().chain().toggleBold().run() ?? false,
      isItalic: ctx.editor.isActive('italic') ?? false,
      canItalic: ctx.editor.can().chain().toggleItalic().run() ?? false,
      isStrike: ctx.editor.isActive('strike') ?? false,
      canStrike: ctx.editor.can().chain().toggleStrike().run() ?? false,
      isCode: ctx.editor.isActive('code') ?? false,
      canCode: ctx.editor.can().chain().toggleCode().run() ?? false,
      isParagraph: ctx.editor.isActive('paragraph') ?? false,
      isHeading1: ctx.editor.isActive('heading', { level: 1 }) ?? false,
      isHeading2: ctx.editor.isActive('heading', { level: 2 }) ?? false,
      isHeading3: ctx.editor.isActive('heading', { level: 3 }) ?? false,
      isHeading4: ctx.editor.isActive('heading', { level: 4 }) ?? false,
      isHeading5: ctx.editor.isActive('heading', { level: 5 }) ?? false,
      isHeading6: ctx.editor.isActive('heading', { level: 6 }) ?? false,
      isBulletList: ctx.editor.isActive('bulletList') ?? false,
      isOrderedList: ctx.editor.isActive('orderedList') ?? false,
    }),
  });

  return (
    <div
      className="sticky z-10 rounded-t-md border-b bg-background/80 p-1 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      style={{ top: stickyTop ?? 'var(--header-height)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
        {/* Text formatting */}
        <Button variant={editorState.isBold ? 'secondary' : 'ghost'} size="icon" type="button"
          onClick={() => editor.chain().focus().toggleBold().run()} disabled={!editorState.canBold}>
          <Bold />
        </Button>
        <Button variant={editorState.isItalic ? 'secondary' : 'ghost'} size="icon" type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()} disabled={!editorState.canItalic}>
          <Italic />
        </Button>
        <Button variant={editorState.isStrike ? 'secondary' : 'ghost'} size="icon" type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()} disabled={!editorState.canStrike}>
          <Strikethrough />
        </Button>
        <Button variant={editorState.isCode ? 'secondary' : 'ghost'} size="icon" type="button"
          onClick={() => editor.chain().focus().toggleCode().run()} disabled={!editorState.canCode}>
          <Code />
        </Button>

        {/* Blocks */}
        <Button variant={editorState.isParagraph ? 'secondary' : 'ghost'} size="icon" type="button"
          onClick={() => editor.chain().focus().setParagraph().run()}>
          <Pilcrow />
        </Button>
        <Button variant={editorState.isHeading1 ? 'secondary' : 'ghost'} size="icon" type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 />
        </Button>
        <Button variant={editorState.isHeading2 ? 'secondary' : 'ghost'} size="icon" type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 />
        </Button>
        <Button variant={editorState.isHeading3 ? 'secondary' : 'ghost'} size="icon" type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 />
        </Button>
        <Button variant={editorState.isHeading4 ? 'secondary' : 'ghost'} size="icon" type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}>
          <Heading4 />
        </Button>
        <Button variant={editorState.isHeading5 ? 'secondary' : 'ghost'} size="icon" type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}>
          <Heading5 />
        </Button>
        <Button variant={editorState.isHeading6 ? 'secondary' : 'ghost'} size="icon" type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()}>
          <Heading6 />
        </Button>

        {/* Lists */}
        <Button variant={editorState.isBulletList ? 'secondary' : 'ghost'} size="icon" type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List />
        </Button>
        <Button variant={editorState.isOrderedList ? 'secondary' : 'ghost'} size="icon" type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered />
        </Button>

        {/* Alignment */}
        <Button variant={editor.isActive({ textAlign: 'left' }) ? 'secondary' : 'ghost'} size="icon" type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}>
          <AlignLeft />
        </Button>
        <Button variant={editor.isActive({ textAlign: 'center' }) ? 'secondary' : 'ghost'} size="icon" type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}>
          <AlignCenter />
        </Button>
        <Button variant={editor.isActive({ textAlign: 'right' }) ? 'secondary' : 'ghost'} size="icon" type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}>
          <AlignRight />
        </Button>

        {/* Image */}
        <ImageMenu editor={editor} />

        {/* Column layout picker */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" type="button" className="h-8 gap-1 px-2" title="Insertar columnas">
              <LayoutTemplate className="h-4 w-4" />
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-auto">
            <div className="p-2">
              <p className="mb-2 text-[11px] font-medium text-muted-foreground">Columnas</p>
              <div className="flex gap-1.5">
                {[2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="flex h-12 w-10 flex-col items-center justify-center gap-1 rounded-md border bg-muted/40 text-xs font-medium transition-colors hover:border-primary hover:bg-primary/10"
                    onClick={() => editor.chain().focus().insertColumnLayout(n).run()}
                  >
                    <div className="flex gap-0.5">
                      {Array.from({ length: n }).map((_, i) => (
                        <div key={i} className="h-5 w-2 rounded-sm bg-foreground/30" />
                      ))}
                    </div>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Table */}
        <TableMenu editor={editor} />
        </div>

        {pageSizeProps && (
          <Select value={pageSizeProps.value} onValueChange={pageSizeProps.onChange}>
            <SelectTrigger className="h-8 w-[90px] shrink-0 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeProps.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}

export { MenuBar };
