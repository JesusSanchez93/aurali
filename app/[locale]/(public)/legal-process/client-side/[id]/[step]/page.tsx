import PersonalDataForm from "@/app/[locale]/(public)/legal-process/client-side/[id]/[step]/_components/PersonalDataForm";
import { notFound } from "next/navigation";
import { JSX } from "react";
import { createClient } from "@/lib/supabase/server";
import BankingInformationForm from "./_components/BankingInformationForm";
import InfoAboutEventsForm from "./_components/InfoAboutEventsForm";
import SuccessForm from "./_components/SuccessForm";
import { DynamicStepForm } from "./_components/DynamicStepForm";
import { getFormResponse, getFormSchema } from "./dynamic-actions";
import { resolveSectionOptions } from "@/lib/forms/catalogOptions";

interface Props {
  params: Promise<{ id: string; step: string }>;
}

// Flujo legado (fraude bancario, workflow "Fraudes Financieros"): pasos y
// componentes fijos, sin tocar — se usa cuando el proceso no tiene un
// form_schema dinámico asociado (legal_processes.form_schema_id IS NULL).
const LEGACY_STEPS_MAP: Record<string, () => JSX.Element> = {
  'personal-data': () => <PersonalDataForm />,
  'back-information': () => <BankingInformationForm />,
  'info-events': () => <InfoAboutEventsForm />,
  'success': () => <SuccessForm />,
};

export default async function ProcessCompleteStepPage({ params }: Props) {
  const { id, step } = await params;

  const supabase = await createClient();
  const { data: process } = await supabase
    .from('legal_processes')
    .select('form_schema_id, organization_id')
    .eq('id', id)
    .single();

  if (!process?.form_schema_id) {
    const StepComponent = LEGACY_STEPS_MAP[step];
    if (!StepComponent) notFound();
    return <StepComponent />;
  }

  if (step === 'success') {
    return <SuccessForm />;
  }

  if (!process.organization_id) notFound();

  const schema = await getFormSchema(process.form_schema_id);
  const sections = [...schema.sections].sort((a, b) => a.order - b.order);
  const section = sections.find((s) => s.key === step);

  if (!section) notFound();

  const [existingResponse, resolvedSection] = await Promise.all([
    getFormResponse(id, step),
    resolveSectionOptions(section, supabase, process.organization_id),
  ]);

  const sectionIndex = sections.indexOf(section);
  const previousSectionKey = sectionIndex > 0 ? sections[sectionIndex - 1].key : undefined;

  return (
    <DynamicStepForm
      formSchemaId={process.form_schema_id}
      section={resolvedSection}
      defaultValues={existingResponse}
      previousSectionKey={previousSectionKey}
    />
  );
}