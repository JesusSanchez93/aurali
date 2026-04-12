import { Node } from '@tiptap/core';

// ─── TypeScript command augmentation ─────────────────────────────────────────
declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        variable: {
            /** Inserts a variable as plain text {VARIABLE_NAME} */
            insertVariable: (variable: string) => ReturnType;
        };
    }
}

/**
 * Kept only for backward compatibility with documents that have variable atom
 * nodes in their saved TipTap JSON. New insertions use plain text via
 * insertVariable, which the VariableHighlight extension styles via decorations.
 */
export const VariableNode = Node.create({
    name: 'variable',
    group: 'inline',
    inline: true,
    atom: true,

    addAttributes() {
        return {
            variable: { default: '' },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-variable]',
                getAttrs: (el) => ({
                    variable: (el as HTMLElement).getAttribute('data-variable') ?? '',
                }),
            },
        ];
    },

    renderHTML({ node }) {
        return ['span', { 'data-variable': node.attrs.variable }, `{${node.attrs.variable}}`];
    },

    renderText({ node }) {
        return `{${node.attrs.variable}}`;
    },

    addCommands() {
        return {
            insertVariable:
                (variable: string) =>
                ({ commands }) =>
                    commands.insertContent(`{${variable}}`),
        };
    },
});
