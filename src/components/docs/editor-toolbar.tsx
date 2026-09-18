'use client';

import { useState, type ReactNode } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered, ListTodo,
  IndentIncrease, IndentDecrease, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Undo2, Redo2, Palette, Highlighter, Plus, ChevronDown, Table2, ImagePlus,
  Quote, Code, SquareCode, Minus, Info, AlertTriangle, Subscript, Superscript,
  RemoveFormatting, Ellipsis, Rows3, Columns3, Trash2, Merge, Split, Link as LinkIcon,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { NativeSelect, NativeSelectOption } from '@/components/shadcn/native-select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shadcn/tooltip';
import { Popover, PopoverTrigger, PopoverContent } from './primitives/popover';
import { headingLevels, fontSizes, textColours, highlightColours } from '@/lib/docs/formatting';

function Tool({ label, icon: Icon, onClick, active, disabled }: {
  label: string; icon: LucideIcon; onClick: () => void; active?: boolean; disabled?: boolean;
}) {
  return <Tooltip><TooltipTrigger asChild>
    <Button type="button" variant="ghost" className={`toolbar-button ${active ? 'active' : ''}`}
      aria-label={label} aria-pressed={active} disabled={disabled}
      onMouseDown={event => event.preventDefault()} onClick={onClick}><Icon size={18} /></Button>
  </TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}

function ToolMenu({ label, icon: Icon, disabled, compact = false, children }: {
  label: string; icon: LucideIcon; disabled: boolean; compact?: boolean; children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return <Popover open={open && !disabled} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button type="button" variant="ghost" disabled={disabled} className="editor-menu-trigger" aria-label={label} title={compact ? label : undefined}>
      <Icon size={18} />{!compact && <>{label}<ChevronDown size={14} /></>}
    </Button></PopoverTrigger>
    <PopoverContent align="start" className="editor-tool-menu" onCloseAutoFocus={event => {
      // Commands return focus to the document; Escape still returns to the trigger.
      if (document.activeElement?.closest('.editor-prose, .editor-insert-panel')) event.preventDefault();
    }}>
      {children(() => setOpen(false))}
    </PopoverContent>
  </Popover>;
}

export function EditorToolbar({ editor, disabled, openLink, openImage }: {
  editor: Editor | null; disabled: boolean; openLink: () => void; openImage?: () => void;
}) {
  const state = useEditorState({ editor, selector: ({ editor: e }) => {
    const item = e?.isActive('taskItem') ? 'taskItem' : 'listItem';
    return {
      heading: e?.isActive('heading') ? String(e.getAttributes('heading').level) : 'p',
      fontSize: e?.getAttributes('textStyle').fontSize || '',
      marks: Object.fromEntries(['bold', 'italic', 'underline', 'strike', 'subscript', 'superscript', 'code', 'blockquote', 'bulletList', 'orderedList', 'taskList'].map(name => [name, e?.isActive(name)])),
      align: e?.getAttributes('paragraph').textAlign || e?.getAttributes('heading').textAlign || 'left',
      colour: e?.getAttributes('textStyle').color, highlight: e?.getAttributes('highlight').color,
      table: e?.isActive('table'), canUndo: e?.can().undo(), canRedo: e?.can().redo(), item,
      canIndent: e?.can().sinkListItem(item), canOutdent: e?.can().liftListItem(item),
      canMerge: e?.can().mergeCells(), canSplit: e?.can().splitCell(),
    };
  } });
  const unavailable = disabled || !editor;
  const tool = (label: string, icon: LucideIcon, run: () => void, active?: boolean, unavailableHere = false) =>
    <Tool key={label} label={label} icon={icon} onClick={run} active={active} disabled={unavailable || unavailableHere} />;
  const menuItem = (label: string, Icon: LucideIcon, run: () => void, close: () => void, active?: boolean, unavailableHere = false) =>
    <Button key={label} type="button" variant="ghost" className="editor-menu-item" disabled={unavailable || unavailableHere}
      aria-pressed={active} onClick={() => { if (!unavailable) run(); close(); }}><Icon size={18} />{label}</Button>;
  const colourMenu = (highlight: boolean) => <ToolMenu label={highlight ? 'Highlight' : 'Colour'} icon={highlight ? Highlighter : Palette} disabled={unavailable} compact>
    {close => <>
      <p className="editor-menu-label">{highlight ? 'Highlight colour' : 'Text colour'}</p>
      <div className="editor-colour-grid">
        {(highlight ? highlightColours : textColours).map(colour => <Button key={colour.value} type="button" variant="outline"
          aria-label={`${colour.name} ${highlight ? 'highlight' : 'text'}`} title={colour.name}
          aria-pressed={(highlight ? state?.highlight : state?.colour) === colour.value}
          onClick={() => {
            if (!unavailable) {
              if (highlight) editor?.chain().focus().setHighlight({ color: colour.value }).run();
              else editor?.chain().focus().setColor(colour.value).run();
            }
            close();
          }}><span aria-hidden="true" style={{ backgroundColor: colour.value }} /></Button>)}
      </div>
      {menuItem(highlight ? 'Remove highlight' : 'Default text colour', RemoveFormatting, () => {
        if (highlight) editor?.chain().focus().unsetHighlight().run();
        else editor?.chain().focus().unsetColor().run();
      }, close)}
    </>}
  </ToolMenu>;

  return <>
    <div className="editor-toolbar editor-formatting-row" role="group" aria-label="Text formatting">
      <div className="editor-style-select"><NativeSelect aria-label="Text style" value={state?.heading || 'p'} disabled={unavailable}
        onChange={event => {
          if (event.target.value === 'p') editor?.chain().focus().setParagraph().run();
          else editor?.chain().focus().setHeading({ level: Number(event.target.value) as typeof headingLevels[number] }).run();
        }}>
        <NativeSelectOption value="p">Normal text</NativeSelectOption>
        {headingLevels.map(level => <NativeSelectOption key={level} value={String(level)}>H{level} · Heading {level}</NativeSelectOption>)}
      </NativeSelect></div>
      <div className="editor-size-select"><NativeSelect aria-label="Font size" value={state?.fontSize || ''} disabled={unavailable}
        onChange={event => event.target.value ? editor?.chain().focus().setFontSize(event.target.value).run() : editor?.chain().focus().unsetFontSize().run()}>
        <NativeSelectOption value="">Auto size</NativeSelectOption>
        {state?.fontSize && !fontSizes.some(size => `${size}px` === state.fontSize) && <NativeSelectOption value={state.fontSize}>{state.fontSize}</NativeSelectOption>}
        {fontSizes.map(size => <NativeSelectOption key={size} value={`${size}px`}>{size} px</NativeSelectOption>)}
      </NativeSelect></div>
      {tool('Bold', Bold, () => editor?.chain().focus().toggleBold().run(), state?.marks.bold)}
      {tool('Italic', Italic, () => editor?.chain().focus().toggleItalic().run(), state?.marks.italic)}
      {tool('Underline', Underline, () => editor?.chain().focus().toggleUnderline().run(), state?.marks.underline)}
      {tool('Strikethrough', Strikethrough, () => editor?.chain().focus().toggleStrike().run(), state?.marks.strike)}
      {colourMenu(false)}{colourMenu(true)}
      <span className="toolbar-spacer" />
      {tool('Undo', Undo2, () => editor?.chain().focus().undo().run(), undefined, !state?.canUndo)}
      {tool('Redo', Redo2, () => editor?.chain().focus().redo().run(), undefined, !state?.canRedo)}
    </div>
    <div className="editor-toolbar editor-structure-row" role="group" aria-label="Paragraphs and insertions">
      {tool('Bullet list', List, () => editor?.chain().focus().toggleBulletList().run(), state?.marks.bulletList)}
      {tool('Numbered list', ListOrdered, () => editor?.chain().focus().toggleOrderedList().run(), state?.marks.orderedList)}
      {tool('Checklist', ListTodo, () => editor?.chain().focus().toggleTaskList().run(), state?.marks.taskList)}
      {tool('Indent list item', IndentIncrease, () => editor?.chain().focus().sinkListItem(state?.item || 'listItem').run(), undefined, !state?.canIndent)}
      {tool('Outdent list item', IndentDecrease, () => editor?.chain().focus().liftListItem(state?.item || 'listItem').run(), undefined, !state?.canOutdent)}
      <span className="editor-toolbar-divider" />
      {tool('Align left', AlignLeft, () => editor?.chain().focus().setTextAlign('left').run(), state?.align === 'left')}
      {tool('Align centre', AlignCenter, () => editor?.chain().focus().setTextAlign('center').run(), state?.align === 'center')}
      {tool('Align right', AlignRight, () => editor?.chain().focus().setTextAlign('right').run(), state?.align === 'right')}
      {tool('Justify', AlignJustify, () => editor?.chain().focus().setTextAlign('justify').run(), state?.align === 'justify')}
      <span className="editor-toolbar-divider" />
      <ToolMenu label="Insert" icon={Plus} disabled={unavailable}>{close => <>
        {menuItem('Link', LinkIcon, openLink, close)}
        {openImage && menuItem('Image', ImagePlus, openImage, close)}
        {menuItem('Table', Table2, () => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), close, undefined, state?.table)}
        {menuItem('Divider', Minus, () => editor?.chain().focus().setHorizontalRule().run(), close)}
        {menuItem('Code block', SquareCode, () => editor?.chain().focus().toggleCodeBlock().run(), close)}
        {(['info', 'warning'] as const).map(kind => menuItem(kind === 'info' ? 'Information block' : 'Warning block', kind === 'info' ? Info : AlertTriangle, () => editor?.chain().focus().insertContent({
          type: 'callout', attrs: { kind }, content: [{ type: 'paragraph', content: [{ type: 'text', text: kind === 'info' ? 'Important information' : 'Warning' }] }],
        }).run(), close))}
      </>}</ToolMenu>
      <ToolMenu label="More" icon={Ellipsis} disabled={unavailable}>{close => <>
        {menuItem('Block quote', Quote, () => editor?.chain().focus().toggleBlockquote().run(), close, state?.marks.blockquote)}
        {menuItem('Inline code', Code, () => editor?.chain().focus().toggleCode().run(), close, state?.marks.code)}
        {menuItem('Subscript', Subscript, () => editor?.chain().focus().unsetSuperscript().toggleSubscript().run(), close, state?.marks.subscript)}
        {menuItem('Superscript', Superscript, () => editor?.chain().focus().unsetSubscript().toggleSuperscript().run(), close, state?.marks.superscript)}
        {menuItem('Clear formatting', RemoveFormatting, () => editor?.chain().focus().unsetAllMarks().clearNodes().unsetTextAlign().run(), close)}
      </>}</ToolMenu>
      {state?.table && <ToolMenu label="Table" icon={Table2} disabled={unavailable}>{close => <>
        {menuItem('Add row above', Rows3, () => editor?.chain().focus().addRowBefore().run(), close)}
        {menuItem('Add row below', Rows3, () => editor?.chain().focus().addRowAfter().run(), close)}
        {menuItem('Add column before', Columns3, () => editor?.chain().focus().addColumnBefore().run(), close)}
        {menuItem('Add column after', Columns3, () => editor?.chain().focus().addColumnAfter().run(), close)}
        {menuItem('Toggle header row', Rows3, () => editor?.chain().focus().toggleHeaderRow().run(), close)}
        {menuItem('Toggle header column', Columns3, () => editor?.chain().focus().toggleHeaderColumn().run(), close)}
        {menuItem('Merge selected cells', Merge, () => editor?.chain().focus().mergeCells().run(), close, undefined, !state?.canMerge)}
        {menuItem('Split cell', Split, () => editor?.chain().focus().splitCell().run(), close, undefined, !state?.canSplit)}
        {menuItem('Remove row', Trash2, () => editor?.chain().focus().deleteRow().run(), close)}
        {menuItem('Remove column', Trash2, () => editor?.chain().focus().deleteColumn().run(), close)}
        {menuItem('Delete table', Trash2, () => editor?.chain().focus().deleteTable().run(), close)}
      </>}</ToolMenu>}
    </div>
  </>;
}
