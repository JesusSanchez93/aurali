import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
        return NextResponse.redirect(new URL('/link-invalido', request.url));
    }

    const supabase = await createClient();

    const { data: process } = await supabase
        .from('legal_processes')
        .select('id')
        .eq('access_token', token)
        .eq('access_token_used', false)
        .gt('access_token_expires_at', new Date().toISOString())
        .single();

    if (!process) {
        return NextResponse.redirect(new URL('/link-invalido', request.url));
    }

    // 🔐 Marcar token como usado
    await supabase
        .from('legal_processes')
        .update({
            access_token_used: true,
            access_token_used_at: new Date().toISOString(),
        })
        .eq('id', process.id);

    // 🍪 Set cookie (AQUÍ sí está permitido)
    const cookieStore = await cookies();
    cookieStore.set('legal_process_session', process.id, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 60 * 30,
        path: '/',
    });

    return NextResponse.redirect(
        new URL('/process/complete', request.url)
    );
}
