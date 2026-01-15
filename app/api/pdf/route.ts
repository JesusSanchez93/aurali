import { NextResponse } from 'next/server';
import { getBrowser } from '@/lib/puppeteer';
import { tiptapToHTML } from '@/lib/tiptap-to-html';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const browser = await getBrowser();
  const page = await browser.newPage();

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('test_document')
    .select('content')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.content) {
    return NextResponse.json(
      { error: 'Documento no encontrado' },
      { status: 404 },
    );
  }

  const htmlContent = tiptapToHTML(data.content);

  await page.setContent(`
    <html>
      <head>
        <style>
          body { font-family: Inter, sans-serif; padding: 40px; }
          h1, h2, h3 { font-weight: 600; }
          p { margin-bottom: 12px; }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `);

  const pdfUint8 = await page.pdf({
    format: 'A4',
    printBackground: true,
  });

  await browser.close();

  const buffer = Buffer.from(pdfUint8);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="test.pdf"',
    },
  });
}
