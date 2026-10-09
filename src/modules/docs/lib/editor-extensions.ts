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
import { headingLevels, safeColour, readableColour } from './formatting';

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
        ? { style: `color: ${readableColour(attrs.color)}`, 'data-docs-colour': attrs.color }
        : {},
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
    TextStyle, DocumentColor, FontSize,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Highlight.configure({ multicolor: true }), Subscript, Superscript,
    TaskList, TaskItem.configure({ nested: true }),
    Image, Table.configure({ resizable: false }), TableRow, TableHeader, TableCell, Callout,
  ];
}
