import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Image } from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { uploadImage } from '@/lib/uploadImage';
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  CheckSquare,
  Image as ImageIcon,
  TableIcon,
  Heading1,
  Heading2,
  Heading3,
  Palette,
  Type,
  Minus,
  Plus,
  Trash2,
  Undo,
  Redo,
  Clipboard,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '40px'];
const COLORS = [
  '#000000',
  '#374151',
  '#6B7280',
  '#EF4444',
  '#F97316',
  '#EAB308',
  '#22C55E',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#FFFFFF',
];

// Custom fontSize extension via TextStyle marks
import { Extension } from '@tiptap/core';

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el) => el.style.fontSize || null,
            renderHTML: (attrs) => {
              if (!attrs.fontSize) return {};
              return { style: `font-size: ${attrs.fontSize}` };
            },
          },
        },
      },
    ];
  },
});

interface Props {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
}

export default function RichTextEditor({ content, onChange, editable = true }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ bulletList: { keepMarks: true }, orderedList: { keepMarks: true } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: true, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TextStyle,
      Color,
      FontSize,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) uploadAndInsertImage(file);
            return true;
          }
        }
        return false;
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        for (const file of Array.from(files)) {
          if (file.type.startsWith('image/')) {
            event.preventDefault();
            uploadAndInsertImage(file);
            return true;
          }
        }
        return false;
      },
      attributes: {
        class:
          'prose prose-sm max-w-none focus:outline-none min-h-[200px] p-3 dark:prose-invert [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-muted [&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]_li]:flex [&_ul[data-type=taskList]_li]:gap-2 [&_ul[data-type=taskList]_li_label]:mt-0.5 [&_img]:max-w-full [&_img]:rounded-md [&_img]:cursor-pointer',
      },
    },
  });

  const uploadAndInsertImage = useCallback(
    async (file: File) => {
      if (!editor) return;
      try {
        const { publicUrl } = await uploadImage(file, {
          pathPrefix: 'notes',
          sourceTable: 'rich_text_notes',
          sourceField: 'content',
          preserve: true,
        });
        editor.chain().focus().setImage({ src: publicUrl }).run();
      } catch (e) {
        console.error('[RichTextEditor] upload failed', e);
      }
    },
    [editor]
  );

  const handleImageUpload = useCallback(() => fileInputRef.current?.click(), []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadAndInsertImage(file);
      e.target.value = '';
    },
    [uploadAndInsertImage]
  );

  const setFontSize = useCallback(
    (size: string) => {
      editor?.chain().focus().setMark('textStyle', { fontSize: size }).run();
    },
    [editor]
  );

  const setColor = useCallback(
    (color: string) => {
      editor?.chain().focus().setColor(color).run();
    },
    [editor]
  );

  if (!editor) return null;

  const ToolBtn = ({
    onClick,
    active,
    children,
    title,
  }: {
    onClick: () => void;
    active?: boolean;
    children: React.ReactNode;
    title?: string;
  }) => (
    <Button
      type="button"
      variant={active ? 'default' : 'ghost'}
      size="icon"
      className="h-7 w-7 shrink-0"
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      {editable && (
        <div className="flex flex-wrap gap-0.5 p-1.5 border-b bg-muted/30">
          <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Desfazer">
            <Undo className="w-3.5 h-3.5" />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Refazer">
            <Redo className="w-3.5 h-3.5" />
          </ToolBtn>
          <div className="w-px bg-border mx-0.5" />
          <ToolBtn
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title="Negrito"
          >
            <Bold className="w-3.5 h-3.5" />
          </ToolBtn>
          <ToolBtn
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="Itálico"
          >
            <Italic className="w-3.5 h-3.5" />
          </ToolBtn>
          <ToolBtn
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            title="Tachado"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </ToolBtn>
          <div className="w-px bg-border mx-0.5" />
          <ToolBtn
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive('heading', { level: 1 })}
            title="Título 1"
          >
            <Heading1 className="w-3.5 h-3.5" />
          </ToolBtn>
          <ToolBtn
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            title="Título 2"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </ToolBtn>
          <ToolBtn
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })}
            title="Título 3"
          >
            <Heading3 className="w-3.5 h-3.5" />
          </ToolBtn>
          <div className="w-px bg-border mx-0.5" />
          <ToolBtn
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            title="Tópicos"
          >
            <List className="w-3.5 h-3.5" />
          </ToolBtn>
          <ToolBtn
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            title="Lista numerada"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </ToolBtn>
          <ToolBtn
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            active={editor.isActive('taskList')}
            title="Checklist"
          >
            <CheckSquare className="w-3.5 h-3.5" />
          </ToolBtn>
          <div className="w-px bg-border mx-0.5" />

          {/* Font Size */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Tamanho da fonte">
                <Type className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {FONT_SIZES.map((s) => (
                <DropdownMenuItem key={s} onClick={() => setFontSize(s)}>
                  <span style={{ fontSize: s }}>{s}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Color */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Cor da fonte">
                <Palette className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <div className="grid grid-cols-4 gap-1 p-1">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    className="w-6 h-6 rounded border border-border"
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px bg-border mx-0.5" />
          <ToolBtn onClick={handleImageUpload} title="Inserir imagem">
            <ImageIcon className="w-3.5 h-3.5" />
          </ToolBtn>
          <ToolBtn
            onClick={() =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
            title="Inserir tabela"
          >
            <TableIcon className="w-3.5 h-3.5" />
          </ToolBtn>

          {editor.isActive('table') && (
            <>
              <div className="w-px bg-border mx-0.5" />
              <ToolBtn
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                title="Adicionar coluna"
              >
                <Plus className="w-3 h-3" />
              </ToolBtn>
              <ToolBtn
                onClick={() => editor.chain().focus().deleteColumn().run()}
                title="Remover coluna"
              >
                <Minus className="w-3 h-3" />
              </ToolBtn>
              <ToolBtn
                onClick={() => editor.chain().focus().addRowAfter().run()}
                title="Adicionar linha"
              >
                <Plus className="w-3 h-3" />
              </ToolBtn>
              <ToolBtn
                onClick={() => editor.chain().focus().deleteRow().run()}
                title="Remover linha"
              >
                <Minus className="w-3 h-3" />
              </ToolBtn>
              <ToolBtn
                onClick={() => editor.chain().focus().deleteTable().run()}
                title="Remover tabela"
              >
                <Trash2 className="w-3 h-3" />
              </ToolBtn>
            </>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <EditorContent editor={editor} />
    </div>
  );
}
