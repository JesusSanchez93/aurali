import DOMPurify from 'dompurify';

/** Sanitizes TipTap-generated HTML before rendering with dangerouslySetInnerHTML. */
export function sanitizeHtml(html: string): string {
  return String(
    DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'ol', 'ul', 'li', 'h1', 'h2', 'h3', 'blockquote', 'code', 'a'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    }),
  );
}
