/**
 * GET /api/cron/refresh-google-tokens
 *
 * Disparado por Vercel Cron (ver vercel.json). Refresca proactivamente el
 * access_token de cada cuenta de Google conectada y limpia los refresh
 * tokens que Google ya rechazó (invalid_grant), para que la desconexión se
 * detecte y notifique acá en vez de fallar en medio de la generación de un
 * documento real. No soluciona por sí solo un refresh_token que Google
 * expira a los 7 días por tener la pantalla de consentimiento OAuth en modo
 * "Testing" — eso se corrige en Google Cloud Console (Publishing status →
 * In production).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { refreshAllGoogleTokens } from '@/lib/google/auth';

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error('[cron/refresh-google-tokens] CRON_SECRET no configurado');
    return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const summary = await refreshAllGoogleTokens();

    if (summary.revoked.length > 0) {
      console.warn('[cron/refresh-google-tokens] Cuentas desconectadas por refresh token inválido/revocado', summary.revoked);
    }
    if (summary.failed.length > 0) {
      console.warn('[cron/refresh-google-tokens] Refrescos fallidos (se reintentan en la próxima corrida)', summary.failed);
    }

    return NextResponse.json({ ok: true, ...summary });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[cron/refresh-google-tokens] Fallo el cron', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
