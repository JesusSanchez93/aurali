import DOMPurify from 'dompurify';

export function sanitizeSvg(svg: string): string {
  return String(
    DOMPurify.sanitize(svg, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ['script', 'foreignObject', 'iframe'],
      FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover'],
    }),
  );
}
