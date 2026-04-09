'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import Sheet from '@/components/common/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Sparkles, Lightbulb, Check, X, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { AiVariable } from '@/app/[locale]/(dashboard)/settings/ai-variables/actions';
import { createAiVariable, updateAiVariable } from '@/app/[locale]/(dashboard)/settings/ai-variables/actions';
import { validatePrompt, PROMPT_MAX_LENGTH } from '@/lib/ai-variables/validate-prompt';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variable?: AiVariable | null;
}

// Converts a human-readable name to an AI_ prefixed key
function nameToKey(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug ? `AI_${slug}` : 'AI_';
}

export function AiVariableForm({ open, onOpenChange, variable }: Props) {
  const t = useTranslations('settings.ai_variables');
  const tValidation = useTranslations('settings.ai_variables.validation');
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [key, setKey] = useState('AI_');
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [description, setDescription] = useState('');
  const [examples, setExamples] = useState<string[]>([]);

  // Reset form when sheet opens/closes or variable changes
  useEffect(() => {
    if (open) {
      setName(variable?.name ?? '');
      setKey(variable?.key ?? 'AI_');
      setKeyManuallyEdited(!!variable);
      setPrompt(variable?.prompt ?? '');
      setDescription(variable?.description ?? '');
      setExamples(variable?.examples ?? []);
    }
  }, [open, variable]);

  function handleNameChange(value: string) {
    setName(value);
    if (!keyManuallyEdited) {
      setKey(nameToKey(value));
    }
  }

  function handleKeyChange(value: string) {
    const clean = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '');
    const withPrefix = clean.startsWith('AI_') ? clean : `AI_${clean.replace(/^AI?_?/, '')}`;
    setKey(withPrefix);
    setKeyManuallyEdited(true);
  }

  // Real-time prompt validation
  const promptValidation = useMemo(
    () => (prompt.trim().length > 0 ? validatePrompt(prompt, (key) => tValidation(key)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prompt],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !key.trim() || !prompt.trim()) return;
    if (promptValidation && !promptValidation.valid) return;

    startTransition(async () => {
      try {
        const cleanExamples = examples.map((e) => e.trim()).filter(Boolean);
        if (variable) {
          await updateAiVariable(variable.id, { name, key, prompt, description, examples: cleanExamples });
        } else {
          await createAiVariable({ name, key, prompt, description, examples: cleanExamples });
        }
        toast.success(variable ? t('update_success') : t('create_success'));
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('error'));
      }
    });
  }

  const tips = [
    { good: true, text: t('tips.specific') },
    { good: true, text: t('tips.formal') },
    { good: true, text: t('tips.third_person') },
    { good: false, text: t('tips.vague') },
    { good: false, text: t('tips.no_context') },
  ];

  const contextItems = [
    t('context.client_data'),
    t('context.banking_data'),
    t('context.fraud_summary'),
    t('context.attached_pdfs'),
  ];

  const sheetTitle = (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40">
        <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
      </div>
      <span className="text-base font-semibold">
        {variable ? t('edit_title') : t('new_title')}
      </span>
    </div>
  );

  const sheetBody = (
    <form id="ai-var-form" onSubmit={handleSubmit}>
      <div className="flex gap-0 min-h-[100vh] items-start">
        {/* Left: form fields */}
        <div className="flex flex-1 flex-col gap-5 p-6">
          <div className="space-y-2">
            <Label htmlFor="ai-var-name">{t('field_name')}</Label>
            <Input
              id="ai-var-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={t('field_name_placeholder')}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-var-key">{t('field_key')}</Label>
            <Input
              id="ai-var-key"
              value={key}
              onChange={(e) => handleKeyChange(e.target.value)}
              placeholder="AI_HECHOS_DEL_CASO"
              className="font-mono text-sm"
              required
            />
            <p className="text-xs text-muted-foreground">{t('field_key_hint')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-var-description">{t('field_description')}</Label>
            <Input
              id="ai-var-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('field_description_placeholder')}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="ai-var-prompt">{t('field_prompt')}</Label>
              <span className={`text-[11px] tabular-nums ${prompt.length > PROMPT_MAX_LENGTH ? 'text-destructive' : 'text-muted-foreground'}`}>
                {prompt.length}/{PROMPT_MAX_LENGTH}
              </span>
            </div>
            <Textarea
              id="ai-var-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('field_prompt_placeholder')}
              className={`min-h-[180px] resize-y font-mono text-sm leading-relaxed ${promptValidation && !promptValidation.valid ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              required
            />
            {promptValidation && !promptValidation.valid && (
              <div className="flex items-start gap-1.5 text-destructive">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p className="text-xs">{promptValidation.error}</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <Label>{t('examples_title')}</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">{t('examples_description')}</p>
            </div>
            {examples.map((ex, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-2.5 text-xs font-mono text-muted-foreground w-5 shrink-0 text-right">{i + 1}.</span>
                <Textarea
                  value={ex}
                  onChange={(e) => {
                    const next = [...examples];
                    next[i] = e.target.value;
                    setExamples(next);
                  }}
                  placeholder={t('example_placeholder')}
                  className="min-h-[80px] resize-y text-sm leading-relaxed"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-1 h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setExamples(examples.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setExamples([...examples, ''])}
            >
              <Plus className="h-3.5 w-3.5" />
              {t('add_example')}
            </Button>
          </div>
        </div>

        {/* Right: tips */}
        <div className="w-[220px] shrink-0 border border-r-0 bg-muted/30 p-5 rounded-tl-lg rounded-bl-lg">
          <div className="flex items-center gap-1.5 mb-3">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs font-semibold text-foreground">{t('tips_title')}</span>
          </div>

          <div className="space-y-2 mb-5">
            {tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-1.5">
                {tip.good
                  ? <Check className="mt-0.5 h-3 w-3 shrink-0 text-green-500" />
                  : <X className="mt-0.5 h-3 w-3 shrink-0 text-red-400" />
                }
                <p className="text-[11px] leading-relaxed text-muted-foreground">{tip.text}</p>
              </div>
            ))}
          </div>

          <Separator className="mb-4" />

          <p className="mb-2 text-[11px] font-semibold text-foreground">{t('context_title')}</p>
          <ul className="space-y-1.5">
            {contextItems.map((item, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span className="h-1 w-1 shrink-0 rounded-full bg-violet-400" />
                <span className="text-[11px] text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </form>
  );

  const sheetFooter = (
    <div className="flex items-center justify-end gap-2">
      <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
        {t('cancel')}
      </Button>
      <Button
        type="submit"
        form="ai-var-form"
        disabled={
          isPending ||
          !name.trim() ||
          !key.trim() ||
          !prompt.trim() ||
          (promptValidation !== null && !promptValidation.valid)
        }
      >
        {isPending ? t('saving') : variable ? t('save_changes') : t('create')}
      </Button>
    </div>
  );

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      size="3xl"
      title={sheetTitle}
      body={sheetBody}
      footer={sheetFooter}
      stickyHeader
      stickyFooter
    />
  );
}
