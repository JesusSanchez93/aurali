import { NextResponse } from 'next/server';
import { generatePower } from '@/lib/openai/generate-power';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const result = await generatePower(body);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.log({ error });

    return NextResponse.json(
      { success: false, error: 'Error generando el poder' },
      { status: 500 },
    );
  }
}
