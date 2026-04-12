import { Mark } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    uppercase: {
      toggleUppercase: () => ReturnType;
    };
  }
}

export const UppercaseMark = Mark.create({
  name: 'uppercase',

  parseHTML() {
    return [{ style: 'text-transform=uppercase' }];
  },

  renderHTML() {
    return ['span', { style: 'text-transform: uppercase' }, 0];
  },

  addCommands() {
    return {
      toggleUppercase: () => ({ commands }) => commands.toggleMark(this.name),
    };
  },
});
