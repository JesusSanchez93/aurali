import { Resend } from 'resend';

// Instantiated with empty string if key is absent so the module loads without
// throwing. API calls will fail with a Resend auth error, which is caught by
// the sendEmail() wrapper in nodeExecutors.ts.
export const resend = new Resend(process.env.RESEND_API_KEY ?? '');
