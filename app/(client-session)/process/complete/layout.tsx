import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();

  const session = cookieStore.get('legal_process_session');
  if (!session) redirect('/link-invalido');

  return <>{children}</>;
}
