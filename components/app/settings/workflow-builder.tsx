'use client';

import { useState } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical, Plus, Trash2, Settings, MessageSquare, AtSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { updateWorkflowSteps } from '@/app/[locale]/(dashboard)/settings/workflows/actions';
import { toast } from 'sonner';

interface Step {
    id: string;
    title: string;
    description: string;
    step_type: string;
    actions: any[];
}

interface Props {
    templateId: string;
    initialSteps: Step[];
}

export function WorkflowBuilder({ templateId, initialSteps }: Props) {
    const [steps, setSteps] = useState<Step[]>(initialSteps);
    const [isSaving, setIsSaving] = useState(false);
    const t = useTranslations('settings.workflows');

    const addStep = () => {
        const newStep: Step = {
            id: crypto.randomUUID(),
            title: 'Nueva Etapa',
            description: '',
            step_type: 'manual',
            actions: [],
        };
        setSteps([...steps, newStep]);
    };

    const removeStep = (id: string) => {
        setSteps(steps.filter((s) => s.id !== id));
    };

    const updateStep = (id: string, updates: Partial<Step>) => {
        setSteps(steps.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateWorkflowSteps(templateId, steps);
            toast.success(t('save_success'));
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">{t('steps')}</h3>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={addStep}>
                        <Plus className="mr-2 h-4 w-4" />
                        {t('add_step')}
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? '...' : t('save')}
                    </Button>
                </div>
            </div>

            <Reorder.Group
                axis="y"
                values={steps}
                onReorder={setSteps}
                className="flex flex-col gap-3"
            >
                {steps.map((step) => (
                    <ReorderItem
                        key={step.id}
                        step={step}
                        onUpdate={(updates) => updateStep(step.id, updates)}
                        onRemove={() => removeStep(step.id)}
                        t={t}
                    />
                ))}
            </Reorder.Group>

            {steps.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
                    <Settings className="mb-4 h-12 w-12 text-muted-foreground" />
                    <p className="text-muted-foreground">No hay etapas definidas aún.</p>
                </div>
            )}
        </div>
    );
}

function ReorderItem({ step, onUpdate, onRemove, t }: {
    step: Step;
    onUpdate: (updates: Partial<Step>) => void;
    onRemove: () => void;
    t: any;
}) {
    const controls = useDragControls();

    return (
        <Reorder.Item
            value={step}
            dragListener={false}
            dragControls={controls}
            className="group relative"
        >
            <Card>
                <CardContent className="flex items-start gap-4 p-4">
                    <div
                        className="mt-2 cursor-grab active:cursor-grabbing text-muted-foreground transition-colors group-hover:text-foreground"
                        onPointerDown={(e) => controls.start(e)}
                    >
                        <GripVertical className="h-5 w-5" />
                    </div>

                    <div className="grid flex-1 gap-4 md:grid-cols-4">
                        <div className="md:col-span-2">
                            <Input
                                value={step.title}
                                onChange={(e) => onUpdate({ title: e.target.value })}
                                placeholder={t('step_title')}
                                className="font-medium"
                            />
                        </div>
                        <div>
                            <Select
                                value={step.step_type}
                                onValueChange={(value) => onUpdate({ step_type: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={t('step_type')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="manual">{t('types.manual')}</SelectItem>
                                    <SelectItem value="client_input">{t('types.client_input')}</SelectItem>
                                    <SelectItem value="payment">{t('types.payment')}</SelectItem>
                                    <SelectItem value="ai_generation">{t('types.ai_generation')}</SelectItem>
                                    <SelectItem value="ai_wait">{t('types.ai_wait')}</SelectItem>
                                    <SelectItem value="internal_review">{t('types.internal_review')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={onRemove}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Reorder.Item>
    );
}
