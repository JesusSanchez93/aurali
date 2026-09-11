/**
 * Shared HTML builder for the "please sign your documents" email — used by both
 * the send_documents workflow node (lib/workflow/nodeExecutors.ts) and the
 * dashboard's manual resend action (signature-actions.ts), so the client always
 * sees the same download → sign → upload instructions regardless of which path
 * triggered the email.
 */
export function buildSignatureInstructionsHtml(
  introHtml: string,
  docs: { document_name: string; file_url: string }[],
): string {
  const documentsListHtml = docs
    .map((doc) => `<li><a href="${doc.file_url}" target="_blank" rel="noopener noreferrer">${doc.document_name}</a></li>`)
    .join('');

  const instructionsHtml = `
    <p><strong>Siga estos pasos para completar la firma:</strong></p>
    <ol>
      <li>Descargue cada uno de los siguientes documentos:</li>
    </ol>
    <ul>${documentsListHtml}</ul>
    <ol start="2">
      <li>Fírmelos (firma física o digital).</li>
      <li>Haga clic en el botón de abajo para acceder al portal seguro de carga. Le enviaremos un código de verificación a este correo para confirmar su identidad.</li>
      <li>Suba cada documento firmado en el portal.</li>
    </ol>
  `;

  return `${introHtml}${instructionsHtml}`;
}
