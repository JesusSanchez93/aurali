/**
 * pdfGenerator.ts
 *
 * Converts a complete HTML string into a PDF buffer using Puppeteer.
 * Uses the existing getBrowser() helper from lib/puppeteer.ts which handles
 * the Vercel (@sparticuz/chromium) vs. local (puppeteer) branching.
 */

import { getBrowser } from '@/lib/puppeteer';

export interface PdfOptions {
  /** Paper format. Default: 'A4' */
  format?: 'A4' | 'Letter' | 'Legal';
  /** Whether to include CSS backgrounds. Default: true */
  printBackground?: boolean;
  /**
   * Self-contained HTML (with embedded <style>) rendered as a running header
   * on every PDF page. When provided, Puppeteer's displayHeaderFooter is
   * enabled and the header renders inside the top @page margin area.
   */
  headerTemplate?: string;
  /**
   * Self-contained HTML (with embedded <style>) rendered as a running footer
   * on every PDF page. When provided, Puppeteer's displayHeaderFooter is
   * enabled and the footer renders inside the bottom @page margin area.
   */
  footerTemplate?: string;
  /**
   * Top Puppeteer margin (space reserved for the header). Default: '2.5cm'.
   * Pass the document's actual top margin so the header zone matches the doc.
   */
  topMargin?: string;
  /**
   * Bottom Puppeteer margin (space reserved for the footer). Default: '2.5cm'.
   * Pass the document's actual bottom margin so the footer zone matches the doc.
   */
  bottomMargin?: string;
}

/**
 * Renders `html` into a PDF and returns the raw bytes as a Node.js Buffer.
 *
 * The browser is always closed after generation, even on error.
 */
export async function htmlToPdf(html: string, options: PdfOptions = {}): Promise<Buffer> {
  const { format = 'A4', printBackground = true, headerTemplate, footerTemplate, topMargin = '2.5cm', bottomMargin = '2.5cm' } = options;
  const hasHeaderFooter = !!(headerTemplate || footerTemplate);

  const browser = await getBrowser();

  try {
    const page = await browser.newPage();

    // Set viewport to A4 dimensions so page-relative sizes render correctly
    await page.setViewport({ width: 794, height: 1123 });

    // waitUntil:'networkidle0' ensures fonts / external assets finish loading.
    // For fully-embedded templates (no external requests) this resolves quickly.
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBytes = await page.pdf({
      format,
      printBackground,
      // When displayHeaderFooter is active, Puppeteer renders the header/footer
      // templates inside the JS margin area (not the CSS @page margin). We set
      // top/bottom margins here so Puppeteer allocates space for them on every
      // page. The CSS @page top/bottom margins are suppressed via
      // suppressTopBottomPageMargin in wrapWithPageLayout to avoid double-margin.
      // Left/right margins are still handled by CSS @page (3cm each side).
      margin: hasHeaderFooter
        ? { top: topMargin, right: '0', bottom: bottomMargin, left: '0' }
        : { top: '0', right: '0', bottom: '0', left: '0' },
      // When header/footer templates are provided, Puppeteer renders them on
      // every page inside the @page margin areas. An empty <span> placeholder
      // is required for the absent slot so Puppeteer doesn't inject defaults.
      displayHeaderFooter: hasHeaderFooter,
      ...(hasHeaderFooter && {
        headerTemplate: headerTemplate ?? '<span></span>',
        footerTemplate: footerTemplate ?? '<span></span>',
      }),
    });

    return Buffer.from(pdfBytes);
  } finally {
    await browser.close();
  }
}
