'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Sheet from '@/components/common/sheet';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import Stepper from '@/components/common/Stepper';
import { DynamicSectionFields } from '@/components/common/dynamic-form/DynamicSectionFields';
import type { CatalogOptionsSource, FormFieldOption, FormSchema, FormSection } from '@/lib/forms/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema: FormSchema;
  /** Catálogos globales ya resueltos (fetch hecho una vez en el server component
   *  padre) — permite mostrar las opciones reales de un select con `optionsSource`
   *  sin round-trips adicionales desde este componente cliente. */
  catalogOptions: Record<CatalogOptionsSource, FormFieldOption[]>;
}

function resolveSection(section: FormSection, catalogOptions: Props['catalogOptions']): FormSection {
  return {
    ...section,
    fields: section.fields.map((field) =>
      field.optionsSource ? { ...field, options: catalogOptions[field.optionsSource] } : field,
    ),
  };
}

/** Vista previa de solo lectura visual (sin persistencia) del formulario tal
 *  como lo vería el cliente — una sección por pantalla dentro de un marco de
 *  teléfono, con el mismo Stepper y navegación Anterior/Siguiente que el flujo
 *  público real (ProcessCompleteMain + DynamicStepForm). Los inputs están
 *  deshabilitados a propósito: esto es una vista previa del diseño del
 *  formulario, no un simulador donde se pueda escribir/enviar — lo único
 *  interactivo es avanzar/retroceder entre secciones. */
export function FormPreview({ open, onOpenChange, schema, catalogOptions }: Props) {
  const sections = [...schema.sections]
    .sort((a, b) => a.order - b.order)
    .map((s) => resolveSection(s, catalogOptions));
  const [stepIndex, setStepIndex] = useState(0);
  const form = useForm<Record<string, unknown>>({ defaultValues: {} });

  // Reiniciar al primer paso cada vez que se reabre la vista previa
  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  const section = sections[Math.min(stepIndex, sections.length - 1)];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === sections.length - 1;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Vista previa del formulario"
      description="Solo puedes avanzar/retroceder entre secciones — los campos están deshabilitados a propósito."
      size="3xl"
      body={
        <div className="w-full p-4 pt-0">
          {sections.length === 0 ? (
            <p className="text-sm text-muted-foreground">Agrega al menos una sección para ver la vista previa.</p>
          ) : (
            <div className="mx-auto w-[380px]">
              {/* Marco de teléfono — bisel fijo (no depende del tema, es un
                  mockup de dispositivo) envolviendo una "pantalla" que sí usa
                  los tokens de color del formulario real. */}
              <div className="rounded-[2.5rem] border-[10px] border-neutral-900 bg-neutral-900 shadow-xl">
                <div className="relative h-[700px] overflow-hidden rounded-[1.75rem] bg-background">
                  <div className="absolute left-1/2 top-0 z-10 h-5 w-28 -translate-x-1/2 rounded-b-xl bg-neutral-900" />
                  <div className="h-full overflow-y-auto p-4 pt-8">
                    {/* La info real (stepper + campos + botones) se ve a escala
                        0.8 — un teléfono no muestra el contenido al 100% del
                        tamaño "desktop" de estos mismos componentes. */}
                    <div className="w-[100%] origin-top">
                      <div className="mb-5">
                        <Stepper steps={sections.map((s) => s.title || s.key)} currentStep={stepIndex} />
                      </div>

                      <Form {...form}>
                        <div className="space-y-6">
                          <div>
                            <h3 className="text-lg font-semibold">{section.title || section.key}</h3>
                            {section.description && (
                              <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
                            )}
                          </div>
                          <DynamicSectionFields control={form.control} fields={section.fields} disabled />

                          <div className="flex justify-between pt-2">
                            <Button
                              type="button"
                              variant="outline"
                              disabled={isFirst}
                              onClick={() => setStepIndex((i) => Math.max(i - 1, 0))}
                            >
                              <ArrowLeft className="mr-1.5 h-4 w-4" />
                              Anterior
                            </Button>
                            <Button
                              type="button"
                              disabled={isLast}
                              onClick={() => setStepIndex((i) => Math.min(i + 1, sections.length - 1))}
                            >
                              Siguiente
                              <ArrowRight className="ml-1.5 h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      }
    />
  );
}
