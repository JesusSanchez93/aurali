export type ImageAlign = 'left' | 'center' | 'right';
export type ImageLayout = 'inline' | 'wrap' | 'break' | 'behind' | 'front';

type StyleValue = string | number | undefined;
type StyleObject = Record<string, StyleValue>;

interface ImageStyleOptions {
  align: ImageAlign;
  layout: ImageLayout;
  width: number;
}

const FLOAT_GAP_PX = 16;
const BLOCK_GAP_PX = 12;
const INLINE_GAP_PX = 8;

export function normalizeImageAlign(value: unknown): ImageAlign {
  return value === 'left' || value === 'right' || value === 'center' ? value : 'center';
}

export function normalizeImageLayout(value: unknown, hasExplicitLayout = true): ImageLayout {
  if (value === 'inline' || value === 'wrap' || value === 'break' || value === 'behind' || value === 'front') {
    return value;
  }

  // Older documents stored only `align` and always behaved like a block image.
  return hasExplicitLayout ? 'inline' : 'break';
}

export function getImageOuterStyle({ align, layout, width }: ImageStyleOptions): StyleObject {
  if (layout === 'wrap') {
    if (align === 'right') {
      return {
        float: 'right',
        width: `${width}%`,
        maxWidth: '100%',
        margin: `0 0 ${BLOCK_GAP_PX}px ${FLOAT_GAP_PX}px`,
      };
    }

    if (align === 'center') {
      return {
        display: 'block',
        width: `${width}%`,
        maxWidth: '100%',
        margin: `0 auto ${BLOCK_GAP_PX}px`,
        clear: 'both',
      };
    }

    return {
      float: 'left',
      width: `${width}%`,
      maxWidth: '100%',
      margin: `0 ${FLOAT_GAP_PX}px ${BLOCK_GAP_PX}px 0`,
    };
  }

  if (layout === 'behind' || layout === 'front') {
    return {
      position: 'relative',
      display: 'block',
      width: '100%',
      height: 0,
      overflow: 'visible',
      clear: 'both',
      ...(layout === 'front' ? { marginTop: '-48px' } : {}),
    };
  }

  if (layout === 'inline') {
    return {
      display: 'block',
      width: `${width}%`,
      maxWidth: '100%',
      margin:
        align === 'left'
          ? `0 ${INLINE_GAP_PX}px ${INLINE_GAP_PX}px 0`
          : align === 'right'
            ? `0 0 ${INLINE_GAP_PX}px auto`
            : `0 auto ${INLINE_GAP_PX}px`,
    };
  }

  return {
    display: 'block',
    width: `${width}%`,
    maxWidth: '100%',
    margin:
      align === 'left'
        ? `0 auto ${BLOCK_GAP_PX}px 0`
        : align === 'right'
          ? `0 0 ${BLOCK_GAP_PX}px auto`
          : `0 auto ${BLOCK_GAP_PX}px`,
    clear: 'both',
  };
}

export function getImageBoxStyle({ align, layout, width }: ImageStyleOptions): StyleObject {
  if (layout === 'behind' || layout === 'front') {
    return {
      position: 'absolute',
      top: 0,
      width: `${width}%`,
      maxWidth: '100%',
      left: align === 'left' ? 0 : align === 'center' ? '50%' : undefined,
      right: align === 'right' ? 0 : undefined,
      transform: align === 'center' ? 'translateX(-50%)' : undefined,
      zIndex: layout === 'front' ? 10 : -1,
    };
  }

  return {
    position: 'relative',
    width: '100%',
    maxWidth: '100%',
  };
}

export function parseImageWidth(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clampImageWidth(value);
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return clampImageWidth(parsed);
    }
  }

  return 50;
}

export function clampImageWidth(value: number): number {
  return Math.min(100, Math.max(5, Math.round(value)));
}

export function detectImageLayoutFromDom(dom: HTMLElement): ImageLayout {
  const explicit = dom.dataset.layout;
  if (explicit) {
    return normalizeImageLayout(explicit, true);
  }

  return 'break';
}

export function styleObjectToString(style: StyleObject): string {
  return Object.entries(style)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${toKebabCase(key)}:${String(value)}`)
    .join(';');
}

function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}
