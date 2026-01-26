'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import { randomUUID } from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function createLegalProcessDraft(values: {
  document_type: string;
  document_number: string;
  email: string;
  current_organization_id: string;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user || authError) {
    throw new Error('Unauthorized');
  }

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('email', values.email)
    .single();

  let clientId = client?.id;

  if (!client) {
    const { data: newClient, error } = await supabase
      .from('clients')
      .insert({
        status: 'draft',
        document_type: values.document_type,
        document_number: values.document_number,
        email: values.email,
        created_by: user.id,
        organization_id: values.current_organization_id,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      throw new Error(error.message);
    }

    clientId = newClient.id;
  }

  const publicToken = randomUUID();

  const { data: newProcess, error: processError } = await supabase
    .from('legal_processes')
    .insert({
      status: 'draft',
      client_id: clientId,
      document_type: values.document_type,
      document_number: values.document_number,
      email: values.email,
      organization_id: values.current_organization_id,
      access_token: publicToken,
      access_token_expires_at: new Date(Date.now() + 1000 * 60 * 30),
      // created_by: user.id,
    });

  if (processError) {
    console.error({ processError });
    throw new Error(processError.message);
  }

  const link = `${process.env.NEXT_PUBLIC_APP_URL}/process/access?token=${publicToken}`;

  await resend.emails.send({
    from: 'Aurali Legal <no-reply@aurali.app>',
    to: values.email,
    subject: 'Completa tus datos para continuar con tu proceso legal',
    html: `
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Completa tu información</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f4f6f8; font-family: Arial, Helvetica, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8; padding:24px 0;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
            
            <!-- Header -->
            <tr>
              <td style="padding:24px; background-color:#0f172a; color:#ffffff;">
                <h1 style="margin:0; font-size:20px; font-weight:600;">
                  Aurali · Proceso Legal
                </h1>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:32px; color:#111827; font-size:14px; line-height:1.6;">
                <p style="margin-top:0;">Hola,</p>

                <p>
                  Tu abogado/a <strong>{{lawyer_name}}</strong> ha iniciado un proceso legal para ti.
                  Para poder continuar, necesitamos que completes tu información personal y algunos
                  datos relevantes del caso.
                </p>

                <!-- Highlight box -->
                <div style="margin:24px 0; padding:16px; background-color:#f1f5f9; border-left:4px solid #2563eb;">
                  <p style="margin:0; font-weight:600;">🔐 Acceso seguro y de un solo uso</p>
                  <p style="margin:8px 0 0 0;">
                    Este enlace es personal y solo puede utilizarse una vez por motivos de seguridad.
                  </p>
                </div>

                <!-- CTA Button -->
                <table cellpadding="0" cellspacing="0" width="100%" style="margin:32px 0;">
                  <tr>
                    <td align="center">
                      <a
                        href="${link}"
                        style="
                          display:inline-block;
                          padding:14px 24px;
                          background-color:#2563eb;
                          color:#ffffff;
                          text-decoration:none;
                          font-weight:600;
                          border-radius:6px;
                        "
                      >
                        Completar información del proceso
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- Important -->
                <p style="font-weight:600; margin-bottom:8px;">⏳ Importante</p>
                <ul style="padding-left:20px; margin-top:0;">
                  <li>El enlace dejará de funcionar una vez que envíes la información.</li>
                  <li>
                    Si no puedes completar el formulario o el enlace expira, deberás contactar a tu
                    abogado/a para que te habilite uno nuevo.
                  </li>
                </ul>

                <p>
                  Toda la información que ingreses será tratada de forma confidencial y utilizada
                  únicamente para la gestión de tu proceso legal.
                </p>

                <p>
                  Si tienes dudas o inconvenientes, puedes comunicarte directamente con tu abogado/a.
                </p>

                <p style="margin-top:32px;">
                  Saludos,<br />
                  <strong>Equipo Aurali</strong>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:16px; background-color:#f8fafc; font-size:12px; color:#6b7280; text-align:center;">
                © ${new Date().getFullYear()} Aurali. Todos los derechos reservados.
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `,
  });

  revalidatePath('/process');
}
