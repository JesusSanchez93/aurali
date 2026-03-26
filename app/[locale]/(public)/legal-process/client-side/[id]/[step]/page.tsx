import PersonalDataForm from "@/app/[locale]/(public)/legal-process/client-side/[id]/[step]/_components/PersonalDataForm";
import { notFound } from "next/navigation";
import { JSX } from "react";
import BankingInformationForm from "./_components/BankingInformationForm";
import InfoAboutEventsForm from "./_components/InfoAboutEventsForm";
import SuccessForm from "./_components/SuccessForm";

interface Props {
  params: Promise<{ id: string; step: string }>;
}

const stepsMap: Record<string, () => JSX.Element> = {
  'personal-data': () => <PersonalDataForm />,
  'back-information': () => <BankingInformationForm />,
  'info-events': () => <InfoAboutEventsForm />,
  'success': () => <SuccessForm />,
};

export default async function ProcessCompleteStepPage({ params }: Props) {
  const { step } = await params;

  const StepComponent = stepsMap[step];

  if (!StepComponent) {
    notFound();
  }

  return <StepComponent />;
}