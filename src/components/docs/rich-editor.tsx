'use client';
import { Label } from '@/components/shadcn/label';
import { Button } from '@/components/shadcn/button';
import { Input } from '@/components/shadcn/input';
import { useState, useEffect } from 'react';
import { useEditor, EditorContent, type JSONContent } from '@tiptap/react';
import { safeUrl } from '@/lib/docs/content';
import { documentWordCount } from '@/lib/docs/formatting';
import { documentExtensions } from '@/lib/docs/editor-extensions';
import type { Attachment } from '@/lib/docs/types';
import { EditorToolbar } from './editor-toolbar';
import { Message } from './ui';
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
    extensions: documentExtensions(),
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
  // Editing is disabled while the parent is acquiring or has lost its lease.
  useEffect(() => {
    editor?.setEditable(!disabled, false);
  }, [editor, disabled]);
  const words = documentWordCount(value);
  return (
    <div className={`rich-editor ${disabled ? 'disabled' : ''}`}>
      <div className="editor-controls">
        <EditorToolbar editor={editor} disabled={disabled || busy}
          openLink={() => { setPanel('link'); setUrl(editor?.getAttributes('link').href || ''); setError(''); }}
          openImage={upload ? () => { setPanel('image'); setError(''); } : undefined} />
        {panel && (
          <div className="editor-insert-panel">
            {panel === 'link' ? (
              <Label>
                Link URL
                <Input
                  autoFocus
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
                    autoFocus
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
                  disabled={disabled || busy || !editor}
                  onClick={() => {
                    editor?.chain().focus().extendMarkRange('link').unsetLink().run();
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
                disabled={busy || disabled || !editor}
                onClick={async () => {
                  if (disabled || !editor) return;
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
                      if (!editor.isEditable) {
                        setError('Editing is no longer available. Your image was uploaded; reopen the draft before inserting it.');
                        return;
                      }
                      editor
                        .chain()
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
      <div className="editor-status-bar"><span>{words.toLocaleString()} {words === 1 ? 'word' : 'words'}</span><span>Ctrl/Cmd + Z to undo</span></div>
    </div>
  );
}
