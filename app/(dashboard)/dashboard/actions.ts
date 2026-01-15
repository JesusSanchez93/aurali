'use server';

import { resend } from '@/lib/resend';

export async function sendEmail({ email }: { email: string }) {
  await resend.emails.send({
    from: 'Estudio Pérez <onboarding@resend.dev>',
    to: [email],
    subject: 'Nuevo proceso legal',
    html: '<h1>Nuevo proceso legal</h1>',
  });
}
