/**
 * Minimal upload guard for server actions that accept a `File` before
 * persisting it to Supabase Storage. Rejects empty/oversized files and
 * files whose extension doesn't match what the caller expects — callers
 * must run this before any DB or storage write so a rejected file is
 * never processed or uploaded.
 */
export function assertValidUploadFile(
  file: File,
  options: { extensions: string[]; maxBytes: number },
): void {
  if (!(file instanceof File) || file.size <= 0) {
    throw new Error('Archivo vacío o inválido');
  }

  if (file.size > options.maxBytes) {
    const maxMb = Math.floor(options.maxBytes / (1024 * 1024));
    throw new Error(`El archivo supera el tamaño máximo permitido (${maxMb}MB)`);
  }

  const lowerName = file.name.toLowerCase();
  const hasValidExtension = options.extensions.some((ext) => lowerName.endsWith(ext));
  if (!hasValidExtension) {
    throw new Error(`Tipo de archivo no permitido. Se espera: ${options.extensions.join(', ')}`);
  }
}
