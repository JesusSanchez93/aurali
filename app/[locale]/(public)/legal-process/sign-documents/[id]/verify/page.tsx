import { getVerifyPageState } from '../actions';
import { SignatureUnavailable } from '../_components/SignatureUnavailable';
import { VerifyOtpForm } from '../_components/VerifyOtpForm';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function VerifySignatureOtpPage({ params }: Props) {
  const { id } = await params;
  const state = await getVerifyPageState(id);

  if (!state.ok) {
    return <SignatureUnavailable reason={state.reason} />;
  }

  return <VerifyOtpForm requestId={id} clientEmail={state.clientEmail} />;
}
