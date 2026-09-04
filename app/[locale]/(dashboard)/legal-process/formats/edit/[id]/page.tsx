import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FormatsEditRedirectPage({ params }: Props) {
  const { id } = await params;
  redirect(`/document-templates/edit/${id}`);
}
