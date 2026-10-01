import React from 'react';
import { render } from '@react-email/render';
import { WorkflowEmail } from '@/emails/WorkflowEmail';
import { getEmailServiceForOrg } from '@/lib/email/emailService';
import { getEmailProvider } from '@/lib/email/connection';
import type { EmailAttachment, SendEmailResult } from '@/lib/email/types';

/** Thrown by `sendOrgEmail` in modo `strict` cuando la organización no tiene
 *  correo propio conectado — el llamador debe mostrar este mensaje tal cual,
 *  nunca reintentar con el fallback de Aurali. */
export class OrgEmailNotConnectedError extends Error {
  constructor() {
    super('Conecta tu correo en Ajustes → Correo para poder enviar comunicaciones a tus clientes.');
    this.name = 'OrgEmailNotConnectedError';
  }
}

/**
 * Sends a client-facing email through the organization's configured provider
 * (their own SMTP/Google/Microsoft connection). Used by the document-signature
 * portal (OTP codes, approval/rejection notices) and by the dashboard's manual
 * "resend documents" action — flows that already have organizationId on hand
 * and aren't running inside the workflow engine.
 *
 * `strict: true` es obligatorio para cualquier destinatario cliente final:
 * si la organización no tiene una conexión propia en estado 'connected',
 * lanza `OrgEmailNotConnectedError` en vez de caer al remitente interno de
 * Aurali — los correos a clientes nunca deben salir de un remitente ajeno a
 * la organización. Los correos internos de plataforma (equipo propio,
 * abogado asignado) no deben pasar `strict`, y siguen usando el fallback de
 * Aurali/Resend si la org no tiene correo conectado.
 */
export async function sendOrgEmail(
  organizationId: string,
  params: {
    to: string;
    subject: string;
    bodyHtml: string;
    ctaUrl?: string;
    ctaLabel?: string;
    attachments?: EmailAttachment[];
    replyTo?: string;
    messageId?: string;
  },
  options?: { strict?: boolean },
): Promise<SendEmailResult> {
  if (options?.strict) {
    const provider = await getEmailProvider(organizationId);
    if (provider === 'aurali') {
      throw new OrgEmailNotConnectedError();
    }
  }

  const [html, service] = await Promise.all([
    render(
      React.createElement(WorkflowEmail, {
        bodyHtml: params.bodyHtml,
        ctaUrl: params.ctaUrl,
        ctaLabel: params.ctaLabel,
        subject: params.subject,
      }),
    ),
    getEmailServiceForOrg(organizationId),
  ]);
  return service.send({
    to: params.to,
    subject: params.subject,
    html,
    attachments: params.attachments,
    replyTo: params.replyTo,
    messageId: params.messageId,
  });
}
