'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, requireOrgAdmin } from '@/lib/auth/permissions';
import { demoteActiveConnection, getEmailConnectionInfo } from '@/lib/email/connection';
import { encryptSecret } from '@/lib/email/crypto';
import { verifySmtpConnection } from '@/lib/email/smtp/transport';
import { SmtpEmailService } from '@/lib/email/providers/smtpEmailService';
import { createLogger } from '@/lib/utils/logger';
import { revalidatePath } from 'next/cache';
import type { EmailConnectionInfo, SmtpConnectionInput } from '@/lib/email/types';

const logger = createLogger('SETTINGS_EMAIL_ACTIONS');

const smtpSchema = z.object({
  displayName: z.string().trim().min(1, 'El nombre del remitente es obligatorio.').max(120),
  fromEmail: z.string().trim().email('Ingresa un email válido.'),
  host: z.string().trim().min(1, 'El servidor SMTP es obligatorio.').max(255),
  port: z.coerce.number().int().min(1).max(65535),
  security: z.enum(['ssl_tls', 'starttls', 'none']),
  username: z.string().trim().min(1, 'El usuario es obligatorio.').max(255),
  password: z.string().min(1, 'La contraseña es obligatoria.').max(500),
});

async function getOrgContext() {
  const profile = await requireAuth();
  const orgId = profile.current_organization_id;
  if (!orgId) throw new Error('No organization');
  await requireOrgAdmin(orgId);
  return { orgId, userId: profile.id };
}

/**
 * Never returns raw provider/library errors — those go to the server log
 * only. Checks Nodemailer's structured `code`/`responseCode` first (reliable
 * across providers) and falls back to substring-matching the message, since
 * some errors reach here already re-wrapped by SmtpEmailService with the
 * original message appended.
 */
function friendlySmtpError(err: unknown, host?: string): string {
  const code = err && typeof err === 'object' ? (err as { code?: string }).code : undefined;
  const responseCode = err && typeof err === 'object' ? (err as { responseCode?: number }).responseCode : undefined;
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (
    code === 'EAUTH' ||
    responseCode === 535 ||
    lower.includes('auth') ||
    lower.includes('535') ||
    lower.includes('invalid login')
  ) {
    if (host?.toLowerCase().includes('gmail')) {
      return 'No pudimos autenticar con Gmail. Si tu cuenta tiene verificación en dos pasos, genera una "contraseña de aplicación" en tu cuenta de Google (myaccount.google.com/apppasswords) y úsala aquí en lugar de tu contraseña habitual.';
    }
    return 'No pudimos autenticar con el servidor SMTP. Verifica tu usuario y contraseña.';
  }
  if (
    code === 'ECONNECTION' ||
    code === 'ETIMEDOUT' ||
    code === 'ESOCKET' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    lower.includes('econnrefused') ||
    lower.includes('etimedout') ||
    lower.includes('enotfound')
  ) {
    return 'No pudimos conectar con el servidor SMTP. Verifica el host y el puerto.';
  }
  if (lower.includes('certificate') || lower.includes('ssl') || lower.includes('tls')) {
    return 'No pudimos establecer una conexión segura. Verifica el método de seguridad seleccionado.';
  }
  return 'No pudimos conectar con el servidor SMTP. Verifica el servidor, puerto, usuario y contraseña.';
}

export async function getEmailConnection(): Promise<EmailConnectionInfo> {
  const { orgId } = await getOrgContext();
  return getEmailConnectionInfo(orgId);
}

/** Tests SMTP credentials without persisting anything. */
export async function testSmtpConnection(
  input: SmtpConnectionInput,
): Promise<{ success: boolean; message: string }> {
  await getOrgContext();
  const parsed = smtpSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' };
  }

  try {
    await verifySmtpConnection({
      host: parsed.data.host,
      port: parsed.data.port,
      security: parsed.data.security,
      username: parsed.data.username,
      password: parsed.data.password,
    });
    return { success: true, message: 'Conexión SMTP exitosa' };
  } catch (err) {
    logger.error('SMTP test connection failed', err, { host: parsed.data.host, port: parsed.data.port });
    return { success: false, message: friendlySmtpError(err, parsed.data.host) };
  }
}

/**
 * Saves an SMTP connection as the org's active provider. Demotes any other
 * currently-connected provider first — an org may only have one active
 * connection at a time (enforced again by the partial unique index on
 * status='connected'). The UI is expected to have already confirmed the
 * replacement with the user before calling this.
 */
export async function saveSmtpConnection(
  input: SmtpConnectionInput,
): Promise<{ success: boolean; message: string; connection?: EmailConnectionInfo }> {
  const { orgId, userId } = await getOrgContext();
  const parsed = smtpSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' };
  }
  const data = parsed.data;

  try {
    await verifySmtpConnection({
      host: data.host,
      port: data.port,
      security: data.security,
      username: data.username,
      password: data.password,
    });
  } catch (err) {
    logger.error('SMTP save aborted — connection test failed', err, { host: data.host, port: data.port });
    return { success: false, message: friendlySmtpError(err, data.host) };
  }

  let encryptedPassword: string;
  try {
    encryptedPassword = encryptSecret(data.password);
  } catch (err) {
    logger.error('Failed to encrypt SMTP password — is SMTP_CREDENTIALS_ENCRYPTION_KEY set?', err);
    return { success: false, message: 'No pudimos guardar la configuración. Intenta nuevamente.' };
  }

  await demoteActiveConnection(orgId);

  const supabase = await createClient({ admin: true });
  const { error: insertError } = await supabase.from('email_connections').insert({
    organization_id: orgId,
    created_by: userId,
    provider: 'smtp',
    email: data.fromEmail,
    display_name: data.displayName,
    status: 'connected',
    error_message: null,
    smtp_host: data.host,
    smtp_port: data.port,
    smtp_security: data.security,
    smtp_username: data.username,
    smtp_password_encrypted: encryptedPassword,
  });

  if (insertError) {
    logger.error('Failed to persist SMTP connection', undefined, { errorMessage: insertError.message });
    return { success: false, message: 'No pudimos guardar la configuración. Intenta nuevamente.' };
  }

  revalidatePath('/settings/email');
  return { success: true, message: 'SMTP configurado correctamente', connection: await getEmailConnectionInfo(orgId) };
}

const testEmailSchema = z.string().trim().email('Ingresa un email válido.');

/** Sends a test email through the org's currently-connected SMTP configuration. */
export async function sendSmtpTestEmail(to: string): Promise<{ success: boolean; message: string }> {
  const { orgId } = await getOrgContext();
  const parsedTo = testEmailSchema.safeParse(to);
  if (!parsedTo.success) {
    return { success: false, message: parsedTo.error.issues[0]?.message ?? 'Email inválido.' };
  }

  const connection = await getEmailConnectionInfo(orgId);
  if (connection.provider !== 'smtp' || connection.status !== 'connected') {
    return { success: false, message: 'No hay una configuración SMTP conectada.' };
  }

  try {
    await new SmtpEmailService(orgId).send({
      to: parsedTo.data,
      subject: 'Correo de prueba — Aurali',
      html: '<p>Este es un correo de prueba enviado desde la configuración SMTP de tu organización en Aurali.</p>',
    });
    return { success: true, message: 'Correo de prueba enviado correctamente' };
  } catch (err) {
    logger.error('SMTP test email failed', err, { organizationId: orgId });
    return { success: false, message: friendlySmtpError(err, connection.smtp?.host) };
  }
}

/** Disconnects whichever provider is currently active — always falls back to Aurali. */
export async function disconnectEmailConnection(): Promise<void> {
  const { orgId } = await getOrgContext();
  const supabase = await createClient({ admin: true });

  const { error } = await supabase
    .from('email_connections')
    .update({
      status: 'disconnected',
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      smtp_password_encrypted: null,
      smtp_host: null,
      smtp_port: null,
      smtp_security: null,
      smtp_username: null,
    })
    .eq('organization_id', orgId)
    .eq('status', 'connected');

  if (error) throw new Error(error.message);
  revalidatePath('/settings/email');
}
