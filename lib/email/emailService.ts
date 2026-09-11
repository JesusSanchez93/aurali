import { getEmailProvider } from './connection';
import { AuraliEmailService } from './providers/auraliEmailService';
import { GoogleEmailService } from './providers/googleEmailService';
import { MicrosoftEmailService } from './providers/microsoftEmailService';
import { SmtpEmailService } from './providers/smtpEmailService';
import type { EmailService } from './types';

/**
 * Resolves the right EmailService for an organization. Business logic should
 * only ever call `(await getEmailServiceForOrg(orgId)).send(...)` — it never
 * needs to branch on provider itself.
 */
export async function getEmailServiceForOrg(organizationId: string): Promise<EmailService> {
  const provider = await getEmailProvider(organizationId);

  switch (provider) {
    case 'google':
      return new GoogleEmailService(organizationId);
    case 'microsoft':
      return new MicrosoftEmailService(organizationId);
    case 'smtp':
      return new SmtpEmailService(organizationId);
    case 'aurali':
    default:
      return new AuraliEmailService();
  }
}

export type {
  EmailProvider,
  EmailService,
  SendEmailParams,
  SendEmailResult,
  EmailConnectionInfo,
  SmtpConnectionDetails,
  SmtpConnectionInput,
  SmtpSecurity,
} from './types';
export { getEmailProvider, getEmailConnectionInfo } from './connection';
