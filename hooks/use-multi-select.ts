'use client';

import { useState } from 'react';

/**
 * Generic multi-selection state backed by a Set.
 * Useful for checkbox-based list forms where the user picks
 * a subset of items identified by a string or number id.
 */
export function useMultiSelect<T>(initial: T[] = []) {
  const [selected, setSelected] = useState<Set<T>>(new Set(initial));

  function toggle(id: T) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function isSelected(id: T) {
    return selected.has(id);
  }

  function toArray() {
    return Array.from(selected);
  }

  return { selected, toggle, isSelected, toArray };
}
