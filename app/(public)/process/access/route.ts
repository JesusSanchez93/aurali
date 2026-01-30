import { redirect } from 'next/navigation';

export default function EntryPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  if (!searchParams.token) {
    redirect('/link-invalido');
  }

  redirect(`/api/process/entry?token=${searchParams.token}`);
}
