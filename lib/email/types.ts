export type EmailProvider = 'aurali' | 'google' | 'microsoft' | 'smtp';

export type EmailConnectionStatus = 'connected' | 'disconnected' | 'error';

export type SmtpSecurity = 'ssl_tls' | 'starttls' | 'none';

/** Non-secret SMTP fields — safe to render, never includes the password. */
export interface SmtpConnectionDetails {
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
}

/** Safe-to-expose view of an org's email connection — never includes tokens or the SMTP password. */
export interface EmailConnectionInfo {
  provider: EmailProvider;
  email: string;
  displayName: string | null;
  status: EmailConnectionStatus;
  errorMessage: string | null;
  connectedAt: string | null;
  smtp: SmtpConnectionDetails | null;
}

/** Input for saving/testing an SMTP connection — the password is plaintext only in transit from the form to the server action. */
export interface SmtpConnectionInput {
  displayName: string;
  fromEmail: string;
  host: string;
  port: number;
  security: SmtpSecurity;
  username: string;
  password: string;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
}

export interface SendEmailResult {
  id: string | null;
  provider: EmailProvider;
}

/**
 * Business logic sends email through this interface only — it never needs to
 * know whether the org is using Aurali's shared inbox, Gmail, Outlook, or a
 * custom SMTP server. This is the "sending" half of email; kept deliberately
 * separate from receiving (see EmailReceivingProvider below) because SMTP
 * credentials in particular grant no ability to receive mail — connecting
 * SMTP must never be assumed to also wire up inbound processing.
 */
export interface EmailService {
  readonly provider: EmailProvider;
  send(params: SendEmailParams): Promise<SendEmailResult>;
}

/** Alias for EmailService emphasizing the sending/receiving split described in EmailReceivingProvider. */
export type EmailSendingProvider = EmailService;

export interface IncomingEmailMessage {
  from: string;
  to: string;
  subject: string;
  html: string | null;
  text: string | null;
  attachments: EmailAttachment[];
  receivedAt: string;
}

/**
 * Not implemented yet for any provider. Reserved for the inbound flow
 * (client replies to a sent document → Aurali matches it to a process and
 * stores the attachment) via Gmail API / Microsoft Graph / Resend Inbound —
 * IMAP polling would be the fallback for generic SMTP, since SMTP itself is
 * send-only and grants no inbox access.
 */
export interface EmailReceivingProvider {
  readonly provider: EmailProvider;
  fetchNewMessages(): Promise<IncomingEmailMessage[]>;
}
