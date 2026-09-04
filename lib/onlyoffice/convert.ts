/**
 * convert.ts
 *
 * Calls ONLYOFFICE Document Server's Conversion API to turn a .docx (reachable
 * at `fileUrl`) into a PDF, and downloads the resulting file so the caller can
 * store it wherever it wants (Supabase Storage — Document Server never talks
 * to Supabase directly).
 */

import { signOnlyOfficeToken } from './jwt';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('ONLYOFFICE:CONVERT');

function getServerUrl(): string {
  const url = process.env.ONLYOFFICE_URL;
  if (!url) {
    throw new Error('Missing ONLYOFFICE_URL env var.');
  }
  return url.replace(/\/$/, '');
}

interface ConvertServiceResponse {
  endConvert?: boolean;
  fileUrl?: string;
  fileType?: string;
  percent?: number;
  error?: number;
}

export async function convertDocxToPdf(params: {
  fileUrl: string;
  key: string;
  title: string;
}): Promise<Buffer> {
  const payload = {
    async: false,
    filetype: 'docx',
    key: params.key,
    outputtype: 'pdf',
    title: params.title,
    url: params.fileUrl,
  };
  const token = signOnlyOfficeToken(payload);

  const response = await fetch(`${getServerUrl()}/ConvertService.ashx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...payload, token }),
  });

  const rawBody = await response.text();

  if (!response.ok) {
    throw new Error(`ONLYOFFICE ConvertService respondió ${response.status}: ${rawBody}`);
  }

  let result: ConvertServiceResponse;
  try {
    result = JSON.parse(rawBody) as ConvertServiceResponse;
  } catch {
    throw new Error(`ONLYOFFICE ConvertService devolvió una respuesta no JSON: ${rawBody.slice(0, 500)}`);
  }

  if (result.error) {
    throw new Error(`ONLYOFFICE ConvertService devolvió error ${result.error}`);
  }

  if (!result.endConvert || !result.fileUrl) {
    throw new Error('ONLYOFFICE ConvertService no completó la conversión (respuesta inesperada).');
  }

  logger.info('Conversion completed', { key: params.key, fileUrl: result.fileUrl });

  const pdfResponse = await fetch(result.fileUrl);
  if (!pdfResponse.ok) {
    throw new Error(`No se pudo descargar el PDF convertido (status ${pdfResponse.status}).`);
  }

  const arrayBuffer = await pdfResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
