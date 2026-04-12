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
  PenLine,
  PanelLeft,
  PanelRight,
  LayoutTemplate,
  Image as ImageIcon,
  Upload,
  RemoveFormatting,
} from 'lucide-react';
import { useRef, useState } from 'react';

// ─── Text format dropdown (B / I / S / </> / AA) ─────────────────────────────
function TextFormatMenu({ editor, editorState }: {
  editor: Editor;
  editorState: {
    isBold: boolean; canBold: boolean;
    isItalic: boolean; canItalic: boolean;
    isStrike: boolean; canStrike: boolean;
    isCode: boolean; canCode: boolean;
    isUppercase: boolean;
  };
}) {
  const anyActive = editorState.isBold || editorState.isItalic || editorState.isStrike || editorState.isCode || editorState.isUppercase;

  // Pick the icon for the trigger based on what's active
  const TriggerIcon = editorState.isBold ? Bold
    : editorState.isItalic ? Italic
    : editorState.isStrike ? Strikethrough
    : editorState.isCode ? Code
    : Bold;
  const triggerLabel = editorState.isUppercase ? 'AA' : undefined;

  return (
    <div className="flex items-center">
      {/* Primary action: toggle bold */}
      <Button
        variant={anyActive ? 'secondary' : 'ghost'}
        size="icon"
        type="button"
        title="Negrita (⌘B)"
        className="h-8 w-8 rounded-r-none"
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editorState.canBold}
      >
        {triggerLabel
          ? <span className="text-[11px] font-bold leading-none tracking-tight">{triggerLabel}</span>
          : <TriggerIcon className="h-4 w-4" />}
      </Button>

      {/* Chevron: open full dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={anyActive ? 'secondary' : 'ghost'}
            size="icon"
            type="button"
            className="h-8 w-5 rounded-l-none border-l border-l-border/50 px-0"
          >
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem
            onSelect={() => editor.chain().focus().toggleBold().run()}
            disabled={!editorState.canBold}
            className={editorState.isBold ? 'bg-accent' : ''}
          >
            <Bold className="mr-2 h-4 w-4" />
            <span className="flex-1">Negrita</span>
            <kbd className="text-[10px] text-muted-foreground">⌘B</kbd>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => editor.chain().focus().toggleItalic().run()}
            disabled={!editorState.canItalic}
            className={editorState.isItalic ? 'bg-accent' : ''}
          >
            <Italic className="mr-2 h-4 w-4" />
            <span className="flex-1">Cursiva</span>
            <kbd className="text-[10px] text-muted-foreground">⌘I</kbd>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => editor.chain().focus().toggleStrike().run()}
            disabled={!editorState.canStrike}
            className={editorState.isStrike ? 'bg-accent' : ''}
          >
            <Strikethrough className="mr-2 h-4 w-4" />
            <span className="flex-1">Tachado</span>
            <kbd className="text-[10px] text-muted-foreground">⌘⇧S</kbd>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => editor.chain().focus().toggleCode().run()}
            disabled={!editorState.canCode}
            className={editorState.isCode ? 'bg-accent' : ''}
          >
            <Code className="mr-2 h-4 w-4" />
            <span className="flex-1">Código</span>
            <kbd className="text-[10px] text-muted-foreground">⌘`</kbd>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => editor.chain().focus().toggleUppercase().run()}
            className={editorState.isUppercase ? 'bg-accent' : ''}
          >
            <span className="mr-2 h-4 w-4 text-center text-[11px] font-bold leading-none">AA</span>
            <span className="flex-1">Mayúsculas</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => editor.chain().focus().unsetAllMarks().run()}>
            <RemoveFormatting className="mr-2 h-4 w-4" />
            <span className="flex-1">Borrar formato</span>
            <kbd className="text-[10px] text-muted-foreground">⌘\</kbd>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ─── Text type dropdown (Tt / H1–H6) ─────────────────────────────────────────
const HEADING_ICONS = [Heading1, Heading2, Heading3, Heading4, Heading5, Heading6] as const;

function TextTypeMenu({ editor, editorState }: {
  editor: Editor;
  editorState: {
    isParagraph: boolean;
    isHeading1: boolean; isHeading2: boolean; isHeading3: boolean;
    isHeading4: boolean; isHeading5: boolean; isHeading6: boolean;
  };
}) {
  const activeLevel = editorState.isHeading1 ? 1
    : editorState.isHeading2 ? 2
    : editorState.isHeading3 ? 3
    : editorState.isHeading4 ? 4
    : editorState.isHeading5 ? 5
    : editorState.isHeading6 ? 6
    : 0;

  const ActiveIcon = activeLevel > 0 ? HEADING_ICONS[activeLevel - 1] : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={activeLevel > 0 ? 'secondary' : 'ghost'}
          size="sm"
          type="button"
          className="h-8 gap-1 px-2"
          title="Tipo de texto"
        >
          {ActiveIcon
            ? <ActiveIcon className="h-4 w-4" />
            : <span className="text-[13px] font-semibold leading-none tracking-tight">Tt</span>}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuItem
          onSelect={() => editor.chain().focus().setParagraph().run()}
          className={editorState.isParagraph ? 'bg-accent' : ''}
        >
          <span className="mr-2 w-4 text-center text-xs text-muted-foreground">Tt</span>
          <span className="flex-1 text-sm">Texto normal</span>
          <kbd className="text-[10px] text-muted-foreground">⌘⌥0</kbd>
        </DropdownMenuItem>
        {([1, 2, 3, 4, 5, 6] as const).map((level) => {
          const Icon = HEADING_ICONS[level - 1];
          const isActive = editorState[`isHeading${level}` as keyof typeof editorState];
          const sizes = ['text-xl font-bold', 'text-lg font-bold', 'text-base font-semibold', 'text-sm font-semibold', 'text-sm font-medium', 'text-xs font-medium'];
          return (
            <DropdownMenuItem
              key={level}
              onSelect={() => editor.chain().focus().toggleHeading({ level }).run()}
              className={isActive ? 'bg-accent' : ''}
            >
              <Icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className={`flex-1 ${sizes[level - 1]}`}>Título {level}</span>
              <kbd className="text-[10px] text-muted-foreground">⌘⌥{level}</kbd>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Align dropdown ───────────────────────────────────────────────────────────
function AlignMenu({ editor, editorState }: {
  editor: Editor;
  editorState: { isAlignLeft: boolean; isAlignCenter: boolean; isAlignRight: boolean };
}) {
  const ActiveIcon = editorState.isAlignCenter ? AlignCenter
    : editorState.isAlignRight ? AlignRight
    : AlignLeft;
  const anyActive = editorState.isAlignCenter || editorState.isAlignRight;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={anyActive ? 'secondary' : 'ghost'}
          size="sm"
          type="button"
          className="h-8 gap-1 px-2"
          title="Alineación"
        >
          <ActiveIcon className="h-4 w-4" />
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuItem
          onSelect={() => editor.chain().focus().setTextAlign('left').run()}
          className={editorState.isAlignLeft ? 'bg-accent' : ''}
        >
          <AlignLeft className="mr-2 h-4 w-4" />
          <span className="flex-1">Izquierda</span>
          <kbd className="text-[10px] text-muted-foreground">⌘⇧L</kbd>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => editor.chain().focus().setTextAlign('center').run()}
          className={editorState.isAlignCenter ? 'bg-accent' : ''}
        >
          <AlignCenter className="mr-2 h-4 w-4" />
          <span className="flex-1">Centrado</span>
          <kbd className="text-[10px] text-muted-foreground">⌘⇧E</kbd>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => editor.chain().focus().setTextAlign('right').run()}
          className={editorState.isAlignRight ? 'bg-accent' : ''}
        >
          <AlignRight className="mr-2 h-4 w-4" />
          <span className="flex-1">Derecha</span>
          <kbd className="text-[10px] text-muted-foreground">⌘⇧R</kbd>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── List dropdown ────────────────────────────────────────────────────────────
function ListMenu({ editor, editorState }: {
  editor: Editor;
  editorState: { isBulletList: boolean; isOrderedList: boolean };
}) {
  const ActiveIcon = editorState.isOrderedList ? ListOrdered : List;
  const anyActive = editorState.isBulletList || editorState.isOrderedList;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={anyActive ? 'secondary' : 'ghost'}
          size="sm"
          type="button"
          className="h-8 gap-1 px-2"
          title="Listas"
        >
          <ActiveIcon className="h-4 w-4" />
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuItem
          onSelect={() => editor.chain().focus().toggleBulletList().run()}
          className={editorState.isBulletList ? 'bg-accent' : ''}
        >
          <List className="mr-2 h-4 w-4" />
          <span className="flex-1 whitespace-nowrap">Lista simple</span>
          <kbd className="text-[10px] text-muted-foreground">⌘⇧8</kbd>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => editor.chain().focus().toggleOrderedList().run()}
          className={editorState.isOrderedList ? 'bg-accent' : ''}
        >
          <ListOrdered className="mr-2 h-4 w-4" />
          <span className="flex-1 whitespace-nowrap">Lista numerada</span>
          <kbd className="text-[10px] text-muted-foreground">⌘⇧7</kbd>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
              role="button"
              tabIndex={0}
              className={`h-4 w-4 rounded-sm border transition-colors ${
                active
                  ? 'border-primary bg-primary/20'
                  : 'border-border bg-muted/40 hover:border-primary/50'
              }`}
              onMouseEnter={() => setHovered({ row, col })}
              onClick={() => onPick(row, col)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPick(row, col)}
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
      isAlignLeft: ctx.editor.isActive({ textAlign: 'left' }) ?? false,
      isAlignCenter: ctx.editor.isActive({ textAlign: 'center' }) ?? false,
      isAlignRight: ctx.editor.isActive({ textAlign: 'right' }) ?? false,
      isUppercase: ctx.editor.isActive('uppercase') ?? false,
      hasHeader: (() => { let found = false; ctx.editor.state.doc.forEach((n) => { if (n.type.name === 'documentHeader') found = true; }); return found; })(),
      hasFooter: (() => { let found = false; ctx.editor.state.doc.forEach((n) => { if (n.type.name === 'documentFooter') found = true; }); return found; })(),
    }),
  });

  return (
    <div
      className="sticky z-10 rounded-t-md border-b bg-background/80 p-1 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      style={{ top: stickyTop ?? 'var(--header-height)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
        {/* Text formatting group */}
        <TextFormatMenu editor={editor} editorState={editorState} />

        {/* Text type group */}
        <TextTypeMenu editor={editor} editorState={editorState} />

        {/* List group */}
        <ListMenu editor={editor} editorState={editorState} />

        {/* Alignment group */}
        <AlignMenu editor={editor} editorState={editorState} />

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

        {/* Document sections */}
        <div className="mx-1 w-px self-stretch bg-border" />
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="h-8 gap-1.5 px-2 text-xs"
          title={editorState.hasHeader ? 'Ya existe una cabecera' : 'Insertar cabecera de documento'}
          disabled={editorState.hasHeader}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onClick={() => (editor as any).chain().focus().insertDocumentHeader().run()}
        >
          <PanelTop className="h-3.5 w-3.5" />
          Cabecera
        </Button>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="h-8 gap-1.5 px-2 text-xs"
          title={editorState.hasFooter ? 'Ya existe un pie de página' : 'Insertar pie de página de documento'}
          disabled={editorState.hasFooter}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onClick={() => (editor as any).chain().focus().insertDocumentFooter().run()}
        >
          <PanelBottom className="h-3.5 w-3.5" />
          Pie
        </Button>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="h-8 gap-1.5 px-2 text-xs"
          title="Insertar espacio de firma"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onClick={() => (editor as any).chain().focus().insertSignatureSpace().run()}
        >
          <PenLine className="h-3.5 w-3.5" />
          Firma
        </Button>
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
