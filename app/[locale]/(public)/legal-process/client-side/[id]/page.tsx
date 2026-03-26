import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProcessCompletePage({ params }: Props) {
  const { id } = await params;
  redirect(`/legal-process/client-side/${id}/personal-data`);
}
