import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generatePower } from '@/lib/openai/generate-power';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('API:POWERS_GENERATE');

const PowerInputSchema = z.object({
  country: z.literal('CO'),
  powerType: z.enum(['GENERAL', 'ESPECIAL']),
  grantor: z.object({
    fullName: z.string().min(1),
    documentType: z.enum(['CC', 'CE']),
    documentNumber: z.string().min(1),
    city: z.string().min(1),
  }),
  attorney: z.object({
    fullName: z.string().min(1),
    documentNumber: z.string().min(1),
  }),
  scope: z.string().min(1),
  validity: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const raw = await req.json();
    const parsed = PowerInputSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const body = parsed.data;

    logger.info('Power generation request received');
    const result = await generatePower(body);
    logger.info('Power generated successfully');

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Power generation failed', error);

    return NextResponse.json(
      { success: false, error: 'Error generando el poder' },
      { status: 500 },
    );
  }
}
