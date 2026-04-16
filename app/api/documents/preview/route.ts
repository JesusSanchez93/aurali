import { createClient } from '@/lib/supabase/server';
import { buildPreviewHtml } from '@/lib/documents/generateDocument';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { content, fontFamily, name } = await req.json() as {
    content: unknown;
    fontFamily?: string;
    name?: string;
  };

  if (!content) {
    return new Response('Missing content', { status: 400 });
  }

  try {
    const html = buildPreviewHtml(content, name ?? 'Vista previa', fontFamily);
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err) {
    return new Response(
      err instanceof Error ? err.message : 'Error generating preview',
      { status: 500 },
    );
  }
}
