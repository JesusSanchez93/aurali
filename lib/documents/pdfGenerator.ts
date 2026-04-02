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
}

/**
 * Renders `html` into a PDF and returns the raw bytes as a Node.js Buffer.
 *
 * The browser is always closed after generation, even on error.
 */
export async function htmlToPdf(html: string, options: PdfOptions = {}): Promise<Buffer> {
  const { format = 'A4', printBackground = true, headerTemplate, footerTemplate } = options;
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
      // These margins are already defined by @page CSS inside the template,
      // so we set them to zero here to avoid double-margin.
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
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
