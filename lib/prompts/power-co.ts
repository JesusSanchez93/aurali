import { PowerInput } from '@/types/power';

export function buildPowerPrompt(input: PowerInput) {
  return `
Actúa como un abogado especialista en derecho civil colombiano.

Tu tarea es redactar un PODER ${input.powerType} con lenguaje jurídico formal,
pero el resultado DEBE ser generado como contenido estructurado para un editor Tiptap (ProseMirror).

REGLAS ESTRICTAS (OBLIGATORIAS):
- El resultado DEBE ser JSON válido
- El nodo raíz DEBE ser de tipo "doc"
- La propiedad "content" DEBE ser un arreglo de nodos
- NO agregues explicaciones, comentarios ni texto fuera del JSON
- NO uses Markdown
- NO uses HTML
- NO inventes datos
- Todo el texto DEBE ir dentro de nodos de tipo "text"
- Usa nodos "heading" para títulos
- Usa nodos "paragraph" para párrafos
- Evitar saltos de linea es un string con estructura JSON Object

ESTRUCTURA BASE OBLIGATORIA:
{
  "type": "doc",
  "content": []
}

TIPOS DE NODOS PERMITIDOS:
- doc
- heading (con attrs.level)
- paragraph
- text

EJEMPLO SIMPLE DE SALIDA:
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "Texto de ejemplo" }
      ]
    }
  ]
}

CONTENIDO DEL PODER:

OTORGANTE:
${input.grantor.fullName}
${input.grantor.documentType} ${input.grantor.documentNumber}
${input.grantor.city}

APODERADO:
${input.attorney.fullName}
${input.attorney.documentNumber}

OBJETO DEL PODER:
${input.scope}

VIGENCIA:
${input.validity ?? 'Indefinida'}

INSTRUCCIONES FINALES:
- Redacta el poder de forma completa y coherente
- Finaliza el documento con lugar y fecha
- Todo el contenido debe estar correctamente estructurado en JSON Tiptap
- Devuelve ÚNICAMENTE el JSON
- evita nodos vacions
- todas las key de cada nodo debes estar entre comillas {"<nodeName>" : "<content>"}
- evitar generar sin comillas { <nodeName>: "<content>" }
`;
}
