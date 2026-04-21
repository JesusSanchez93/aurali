import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node } from '@tiptap/pm/model';

/** Matches {GROUP.TYPE} — uppercase letters, digits, underscores, one dot separator */
const VARIABLE_RE = /\{[A-Z_][A-Z0-9_.]*\}/g;

const pluginKey = new PluginKey<DecorationSet>('variableHighlight');

function buildDecorations(doc: Node, validKeys: Set<string>): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    // Legacy atom variable nodes from old documents
    if (node.type.name === 'variable') {
      if (validKeys.has(node.attrs.variable as string)) {
        decorations.push(
          Decoration.node(pos, pos + node.nodeSize, { class: 'tiptap-variable' }),
        );
      }
      return;
    }

    if (!node.isText || !node.text) return;

    VARIABLE_RE.lastIndex = 0;
    let match;
    while ((match = VARIABLE_RE.exec(node.text)) !== null) {
      const key = match[0].slice(1, -1); // strip { and }
      if (!validKeys.has(key)) continue;
      decorations.push(
        Decoration.inline(
          pos + match.index,
          pos + match.index + match[0].length,
          { class: 'tiptap-variable' },
        ),
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}

/**
 * Detects {VARIABLE_NAME} patterns in plain text in real-time and applies
 * a visual decoration. Only keys present in the valid set (static + AI variables)
 * are highlighted. The text remains fully editable.
 */
export const VariableHighlight = Extension.create<{ validKeys: Set<string> }>({
  name: 'variableHighlight',

  addOptions() {
    return { validKeys: new Set<string>() };
  },

  addProseMirrorPlugins() {
    const validKeys = this.options.validKeys;

    return [
      new Plugin({
        key: pluginKey,
        state: {
          init(_, { doc }) {
            return buildDecorations(doc, validKeys);
          },
          apply(tr, decorationSet) {
            if (!tr.docChanged) return decorationSet;
            return buildDecorations(tr.doc, validKeys);
          },
        },
        props: {
          decorations(state) {
            return pluginKey.getState(state);
          },
        },
      }),
    ];
  },
});
