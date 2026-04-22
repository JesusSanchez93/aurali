import { NextResponse } from 'next/server';
import { generatePower } from '@/lib/openai/generate-power';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('API:POWERS_GENERATE');

export async function POST(req: Request) {
  try {
    const body = await req.json();

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
