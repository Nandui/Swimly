'use client';
import { NativeSelect, NativeSelectOption } from '@/components/shadcn/native-select';
import { Label } from '@/components/shadcn/label';
import { Button } from '@/components/shadcn/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shadcn/tooltip';
import { Separator } from '@/components/shadcn/separator';
import { Input } from '@/components/shadcn/input';
import { useState, useEffect } from 'react';
import { useEditor, EditorContent, useEditorState, type JSONContent } from '@tiptap/react';
import { Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link as LinkIcon,
  Table2,
  Undo2,
  Redo2,
  Info,
  AlertTriangle,
  ImagePlus,
  Rows3,
  Columns3,
  Trash2,
} from 'lucide-react';
import { safeUrl } from '@/lib/docs/content';
import type { Attachment } from '@/lib/docs/types';
import { Message } from './ui';
const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      kind: {
        default: 'info',
        parseHTML: (e) => e.getAttribute('data-kind'),
        renderHTML: (attrs) => ({ 'data-kind': attrs.kind }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'aside[data-callout]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'aside',
      mergeAttributes(HTMLAttributes, {
        'data-callout': '',
        class: `document-callout ${HTMLAttributes['data-kind'] === 'warning' ? 'warning' : 'info'}`,
      }),
      0,
    ];
  },
});
export function RichEditor({
  value,
  onChange,
  disabled = false,
  upload,
}: {
  value: JSONContent;
  onChange: (value: JSONContent) => void;
  disabled?: boolean;
  upload?: (file: File) => Promise<Attachment>;
}) {
  const [panel, setPanel] = useState<'link' | 'image' | null>(null);
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        code: false,
        codeBlock: false,
        link: { openOnClick: false, protocols: ['http', 'https', 'mailto'] },
      }),
      Image,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Callout,
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    editorProps: {
      attributes: {
        class: 'document-prose editor-prose',
        'aria-label': 'Document content',
        role: 'textbox',
        'aria-multiline': 'true',
      },
    },
  });
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive('bold'),
      italic: e?.isActive('italic'),
      underline: e?.isActive('underline'),
      table: e?.isActive('table'),
      heading: e?.isActive('heading', { level: 2 })
        ? '2'
        : e?.isActive('heading', { level: 3 })
          ? '3'
          : e?.isActive('heading', { level: 4 })
            ? '4'
            : 'p',
    }),
  });
  // Editing is disabled while the parent is acquiring or has lost its lease.
  useEffect(() => {
    editor?.setEditable(!disabled, false);
  }, [editor, disabled]);
  const tool = (label: string, Icon: typeof Bold, onClick: () => void, active = false) => (
    <Tooltip key={label}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          key={label}
          type="button"
          className={`toolbar-button ${active ? 'active' : ''}`}
          aria-label={label}
          title={label}
          aria-pressed={active}
          disabled={disabled || !editor}
          onClick={onClick}
        >
          <Icon size={17} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
  return (
    <div className={`rich-editor ${disabled ? 'disabled' : ''}`}>
      <div className="editor-controls">
        <div className="editor-toolbar" role="toolbar" aria-label="Text formatting">
          <NativeSelect
            aria-label="Text style"
            value={state?.heading || 'p'}
            disabled={disabled || !editor}
            onChange={(e) =>
              e.target.value === 'p'
                ? editor?.chain().focus().setParagraph().run()
                : editor
                    ?.chain()
                    .focus()
                    .toggleHeading({ level: Number(e.target.value) as 2 | 3 | 4 })
                    .run()
            }
          >
            <NativeSelectOption value="p">Normal text</NativeSelectOption>
            <NativeSelectOption value="2">Section heading</NativeSelectOption>
            <NativeSelectOption value="3">Subheading</NativeSelectOption>
            <NativeSelectOption value="4">Small heading</NativeSelectOption>
          </NativeSelect>
          <Separator orientation="vertical" className="toolbar-divider" />
          {tool('Bold', Bold, () => editor?.chain().focus().toggleBold().run(), state?.bold)}
          {tool('Italic', Italic, () => editor?.chain().focus().toggleItalic().run(), state?.italic)}
          {tool(
            'Underline',
            Underline,
            () => editor?.chain().focus().toggleUnderline().run(),
            state?.underline,
          )}
          <Separator orientation="vertical" className="toolbar-divider" />
          {tool('Bullet list', List, () => editor?.chain().focus().toggleBulletList().run())}
          {tool('Numbered list', ListOrdered, () =>
            editor?.chain().focus().toggleOrderedList().run(),
          )}
          {tool('Add link', LinkIcon, () => {
            setPanel('link');
            setUrl(editor?.getAttributes('link').href || '');
            setError('');
          })}
          {tool('Insert table', Table2, () =>
            editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
          )}
          {upload &&
            tool('Insert image', ImagePlus, () => {
              setPanel('image');
              setError('');
            })}
          <Separator orientation="vertical" className="toolbar-divider" />
          {tool('Information block', Info, () =>
            editor
              ?.chain()
              .focus()
              .insertContent({
                type: 'callout',
                attrs: { kind: 'info' },
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'Important information' }] },
                ],
              })
              .run(),
          )}
          {tool('Warning block', AlertTriangle, () =>
            editor
              ?.chain()
              .focus()
              .insertContent({
                type: 'callout',
                attrs: { kind: 'warning' },
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Warning' }] }],
              })
              .run(),
          )}
          <span className="toolbar-spacer" />
          {tool('Undo', Undo2, () => editor?.chain().focus().undo().run())}
          {tool('Redo', Redo2, () => editor?.chain().focus().redo().run())}
        </div>
        {state?.table && (
          <div className="editor-table-tools">
            {tool('Add table row', Rows3, () => editor?.chain().focus().addRowAfter().run())}
            {tool('Add table column', Columns3, () => editor?.chain().focus().addColumnAfter().run())}
            <Button
              variant="ghost"
              type="button"
              className="button ghost compact"
              onClick={() => editor?.chain().focus().deleteRow().run()}
              disabled={disabled}
            >
              Remove row
            </Button>
            <Button
              variant="ghost"
              type="button"
              className="button ghost compact"
              onClick={() => editor?.chain().focus().deleteColumn().run()}
              disabled={disabled}
            >
              Remove column
            </Button>
            {tool('Delete table', Trash2, () => editor?.chain().focus().deleteTable().run())}
          </div>
        )}
        {panel && (
          <div className="editor-insert-panel">
            {panel === 'link' ? (
              <Label>
                Link URL
                <Input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                />
              </Label>
            ) : (
              <>
                <Label>
                  Image file
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => setImage(e.target.files?.[0] || null)}
                  />
                </Label>
                <Label>
                  Alternative text
                  <Input
                    value={alt}
                    onChange={(e) => setAlt(e.target.value)}
                    placeholder="Describe the image for someone who cannot see it"
                  />
                </Label>
              </>
            )}
            <Message error={error} />
            <div className="form-actions">
              <Button
                variant="outline"
                className="button secondary compact"
                type="button"
                onClick={() => setPanel(null)}
              >
                Cancel
              </Button>
              {panel === 'link' && (
                <Button
                  variant="outline"
                  className="button secondary compact"
                  type="button"
                  onClick={() => {
                    editor?.chain().focus().unsetLink().run();
                    setPanel(null);
                  }}
                >
                  Remove link
                </Button>
              )}
              <Button
                variant="default"
                className="button primary compact"
                type="button"
                disabled={busy}
                onClick={async () => {
                  setError('');
                  if (panel === 'link') {
                    if (!safeUrl(url)) {
                      setError('Use an https, http, or email link.');
                      return;
                    }
                    editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
                    setPanel(null);
                  } else {
                    if (!image || !alt.trim()) {
                      setError('Choose an image and add alternative text.');
                      return;
                    }
                    setBusy(true);
                    try {
                      const file = await upload!(image);
                      editor
                        ?.chain()
                        .focus()
                        .setImage({ src: `/api/docs/files/${file.id}`, alt: alt.trim() })
                        .run();
                      setPanel(null);
                      setAlt('');
                      setImage(null);
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }
                }}
              >
                {busy ? 'Uploading…' : 'Insert'}
              </Button>
            </div>
          </div>
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
