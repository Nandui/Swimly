import { Node, mergeAttributes, getStyleProperty } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import { TextStyle, Color, FontSize } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { headingLevels, safeAlignment, safeColour, safeFontSize, textColourKey, highlightKey, fontSizeKey } from '@/modules/docs/shared/formatting';

// Keep the authored colour in JSON/copy-paste while adapting palette ink to dark mode.
const DocumentColor = Color.extend({
  addGlobalAttributes() {
    return [{ types: this.options.types, attributes: { color: {
      default: null,
      parseHTML: element => {
        const value = element.getAttribute('data-docs-colour') || getStyleProperty(element, 'color') || element.style.color;
        return safeColour(value) ? value : null;
      },
      renderHTML: attrs => safeColour(attrs.color)
        ? { 'data-docs-colour': attrs.color, 'data-colour': textColourKey(attrs.color) }
        : {},
    } } }];
  },
});

// Sizes, highlights and alignment render as data attributes styled by editor.css, never as
// inline styles (AGENTS.md, Screens); the stored value is kept for copy and paste.
const DocumentFontSize = FontSize.extend({
  addGlobalAttributes() {
    return [{ types: this.options.types, attributes: { fontSize: {
      default: null,
      parseHTML: element => {
        const value = element.getAttribute('data-docs-size') || getStyleProperty(element, 'font-size') || element.style.fontSize;
        return safeFontSize(value) ? value : null;
      },
      renderHTML: attrs => safeFontSize(attrs.fontSize) ? { 'data-docs-size': attrs.fontSize, 'data-size': fontSizeKey(attrs.fontSize) } : {},
    } } }];
  },
});

const DocumentHighlight = Highlight.extend({
  addAttributes() {
    return { color: {
      default: null,
      parseHTML: element => {
        const value = element.getAttribute('data-color') || getStyleProperty(element, 'background-color') || element.style.backgroundColor;
        return safeColour(value) ? value : null;
      },
      renderHTML: attrs => safeColour(attrs.color) ? { 'data-color': attrs.color, 'data-highlight': highlightKey(attrs.color) } : {},
    } };
  },
}).configure({ multicolor: true });

const DocumentTextAlign = TextAlign.extend({
  addGlobalAttributes() {
    return [{ types: this.options.types, attributes: { textAlign: {
      default: this.options.defaultAlignment,
      parseHTML: element => {
        const value = element.getAttribute('data-align') || element.style.textAlign;
        return safeAlignment(value) ? value : this.options.defaultAlignment;
      },
      renderHTML: attrs => safeAlignment(attrs.textAlign) ? { 'data-align': attrs.textAlign } : {},
    } } }];
  },
});

const Callout = Node.create({
  name: 'callout', group: 'block', content: 'block+', defining: true,
  addAttributes() {
    return { kind: {
      default: 'info',
      parseHTML: element => element.getAttribute('data-kind'),
      renderHTML: attrs => ({ 'data-kind': attrs.kind }),
    } };
  },
  parseHTML() { return [{ tag: 'aside[data-callout]' }]; },
  renderHTML({ HTMLAttributes }) {
    return ['aside', mergeAttributes(HTMLAttributes, {
      'data-callout': '',
      class: `document-callout ${HTMLAttributes['data-kind'] === 'warning' ? 'warning' : 'info'}`,
    }), 0];
  },
});

export function documentExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [...headingLevels] },
      link: { openOnClick: false, protocols: ['http', 'https', 'mailto'] },
    }),
    TextStyle, DocumentColor, DocumentFontSize,
    DocumentTextAlign.configure({ types: ['heading', 'paragraph'] }),
    DocumentHighlight, Subscript, Superscript,
    TaskList, TaskItem.configure({ nested: true }),
    Image, Table.configure({ resizable: false }), TableRow, TableHeader, TableCell, Callout,
  ];
}
