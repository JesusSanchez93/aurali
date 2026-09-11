import React from 'react';
import { render } from '@react-email/render';
import { WorkflowEmail } from '@/emails/WorkflowEmail';
import { getEmailServiceForOrg } from '@/lib/email/emailService';
import type { EmailAttachment } from '@/lib/email/types';

/**
 * Sends a client-facing email through the organization's configured provider
 * (their own SMTP/Google/Microsoft connection, falling back to Aurali's shared
 * sender — see getEmailServiceForOrg), rendered with the same WorkflowEmail
 * template used across the app. Used by the document-signature portal (OTP
 * codes, approval/rejection notices) and by the dashboard's manual "resend
 * documents" action — flows that already have organizationId on hand and
 * aren't running inside the workflow engine.
 */
export async function sendOrgEmail(
  organizationId: string,
  params: { to: string; subject: string; bodyHtml: string; ctaUrl?: string; ctaLabel?: string; attachments?: EmailAttachment[] },
): Promise<void> {
  const html = await render(
    React.createElement(WorkflowEmail, {
      bodyHtml: params.bodyHtml,
      ctaUrl: params.ctaUrl,
      ctaLabel: params.ctaLabel,
      subject: params.subject,
    }),
  );

  const service = await getEmailServiceForOrg(organizationId);
  await service.send({ to: params.to, subject: params.subject, html, attachments: params.attachments });
}
