import OpenAI from 'openai';
import { buildPowerPrompt } from '@/lib/prompts/power-co';
import { PowerInput } from '@/types/power';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function generatePower(input: PowerInput) {
  const prompt = buildPowerPrompt(input);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.1,
    messages: [
      { role: 'system', content: 'Eres un abogado redactor legal.' },
      { role: 'user', content: prompt },
    ],
  });

  const content = completion.choices[0].message.content;

  console.log('content: ', typeof content);

  const { error } = await supabase.from('test_document').insert({
    title: 'Poder especial',
    content: content ? JSON.parse(content) : null,
  });

  return {
    prompt,
    text: content,
    error,
  };
}
