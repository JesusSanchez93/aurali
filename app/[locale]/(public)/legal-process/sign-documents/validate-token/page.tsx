import { redirect } from 'next/navigation';

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function SignDocumentsValidateTokenPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) redirect('/404');

  redirect(`/api/legal-process/sign-documents/validate-token?token=${token}`);
}
