import { redirect } from 'next/navigation';

interface Props {
  searchParams: Promise<{ token?: string; }>;
}

export default async function ProcessValidateTokenPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) redirect("/404");

  redirect(`/api/legal-process/client-side/validate-token?token=${token}`);
}
