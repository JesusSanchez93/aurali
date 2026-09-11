import { getUploadPageState } from './actions';
import { SignatureUnavailable } from './_components/SignatureUnavailable';
import { UploadSignedDocumentsForm } from './_components/UploadSignedDocumentsForm';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SignDocumentsPage({ params }: Props) {
  const { id } = await params;
  const state = await getUploadPageState(id);

  if (!state.ok) {
    return <SignatureUnavailable reason={state.reason} />;
  }

  return <UploadSignedDocumentsForm requestId={id} requestStatus={state.status} items={state.items} />;
}
