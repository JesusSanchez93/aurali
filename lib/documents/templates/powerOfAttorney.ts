/**
 * Power of Attorney — Poder Especial
 *
 * Variables:
 *   {{client_name}}           Full name of the grantor (poderdante)
 *   {{document_type}}         ID type (e.g. "Cédula de Ciudadanía")
 *   {{document_number}}       ID number
 *   {{client_address}}        Grantor's address
 *   {{client_city}}           Grantor's city of residence
 *   {{lawyer_name}}           Full name of the attorney (apoderado)
 *   {{lawyer_document_number}} Attorney's ID number
 *   {{lawyer_card_number}}    Professional card number (Tarjeta Profesional)
 *   {{lawyer_firm}}           Law firm name
 *   {{case_description}}      Description of the legal matter being delegated
 *   {{city}}                  City where the document is signed
 *   {{document_date}}         Date in full (e.g. "14 de marzo de 2026")
 */

import type { DocumentTemplateDefinition } from './index';

export const POWER_OF_ATTORNEY: DocumentTemplateDefinition = {
  name: 'Poder Especial',
  type: 'power_of_attorney',
  variables: [
    { name: 'client_name',            label: 'Nombre completo del poderdante',  required: true },
    { name: 'document_type',          label: 'Tipo de documento',               required: true },
    { name: 'document_number',        label: 'Número de documento',             required: true },
    { name: 'client_address',         label: 'Dirección del poderdante',        required: false },
    { name: 'client_city',            label: 'Ciudad del poderdante',           required: true },
    { name: 'lawyer_name',            label: 'Nombre del abogado apoderado',    required: true },
    { name: 'lawyer_document_number', label: 'Documento del abogado',           required: false },
    { name: 'lawyer_card_number',     label: 'Tarjeta Profesional No.',         required: true },
    { name: 'lawyer_firm',            label: 'Nombre del bufete',               required: true },
    { name: 'case_description',       label: 'Descripción del asunto',          required: true },
    { name: 'city',                   label: 'Ciudad de firma',                 required: true },
    { name: 'document_date',          label: 'Fecha del documento',             required: true },
  ],

  // ── HTML body (injected inside the page layout wrapper) ───────────────────
  html_template: /* html */ `
    <!-- ── Header ────────────────────────────────────────────────────── -->
    <div class="doc-header">
      <div>
        <div class="firm-name">{{lawyer_firm}}</div>
        <div class="firm-subtitle">Abogados y Consultores — Servicios Jurídicos Especializados</div>
      </div>
      <div class="doc-meta">
        <div>{{city}}</div>
        <div>{{document_date}}</div>
      </div>
    </div>

    <!-- ── Title ──────────────────────────────────────────────────────── -->
    <div class="document-title">Poder Especial</div>

    <!-- ── Body ───────────────────────────────────────────────────────── -->
    <div class="content">

      <p>
        Yo, <strong>{{client_name}}</strong>, mayor de edad, vecino(a) de
        <strong>{{client_city}}</strong>, identificado(a) con
        <strong>{{document_type}}</strong> número <strong>{{document_number}}</strong>,
        domiciliado(a) en {{client_address}}, obrando en mi propio nombre y representación,
        por medio del presente escrito:
      </p>

      <p>
        <strong>CONFIERO PODER ESPECIAL, AMPLIO Y SUFICIENTE</strong>, en los
        términos del artículo 74 del Código General del Proceso, a:
      </p>

      <div class="info-box no-break">
        <p>
          <strong>{{lawyer_name}}</strong>, abogado(a) en ejercicio, identificado(a)
          con documento de identidad número <strong>{{lawyer_document_number}}</strong>,
          titular de la Tarjeta Profesional número <strong>{{lawyer_card_number}}</strong>,
          expedida por el Consejo Superior de la Judicatura de la República de Colombia,
          vinculado(a) al despacho <strong>{{lawyer_firm}}</strong>.
        </p>
      </div>

      <p>
        Para que, en mi nombre y representación, adelante todos los trámites
        judiciales y extrajudiciales, presente escritos, solicite y aporte pruebas,
        interponga los recursos ordinarios y extraordinarios que procedan, participe
        en audiencias de conciliación, mediación y cualquier diligencia que se surta
        dentro del proceso, en relación con el siguiente asunto:
      </p>

      <div class="clause no-break">
        <div class="clause-number">Objeto del poder:</div>
        <div class="info-box">
          <p>{{case_description}}</p>
        </div>
      </div>

      <div class="clause no-break">
        <div class="clause-number">Facultades especiales:</div>
        <p>
          El apoderado queda expresamente facultado para: transigir, desistir,
          allanarse a la demanda, recibir, confesar, comprometer en árbitros o
          amigables componedores, hacer posturas en remate, recibir pagos, renunciar
          a términos procesales y representarme en todas las actuaciones que se
          deriven del proceso judicial o extrajudicial correspondiente.
        </p>
      </div>

      <div class="clause">
        <div class="clause-number">Vigencia:</div>
        <p>
          El presente poder se otorga por el término necesario para el cumplimiento
          del encargo encomendado y podrá ser revocado en cualquier momento mediante
          comunicación escrita dirigida al apoderado.
        </p>
      </div>

    </div>

    <!-- ── Signatures ─────────────────────────────────────────────────── -->
    <div class="signatures no-break">
      <div class="signature-block">
        <div class="sig-space"></div>
        <div class="sig-line"></div>
        <div class="sig-name">{{client_name}}</div>
        <div class="sig-label">{{document_type}}: {{document_number}}</div>
        <div class="sig-label"><em>Poderdante</em></div>
      </div>

      <div class="signature-block">
        <div class="sig-space"></div>
        <div class="sig-line"></div>
        <div class="sig-name">{{lawyer_name}}</div>
        <div class="sig-label">T.P. No. {{lawyer_card_number}}</div>
        <div class="sig-label"><em>Apoderado</em></div>
      </div>
    </div>

    <!-- ── Footer ─────────────────────────────────────────────────────── -->
    <div class="doc-footer">
      Documento generado por <strong>{{lawyer_firm}}</strong> &nbsp;·&nbsp;
      {{city}}, {{document_date}} &nbsp;·&nbsp; Aurali Legal Platform
    </div>
  `,
};
