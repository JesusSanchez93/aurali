/**
 * Legal Contract — Contrato de Prestación de Servicios Legales
 *
 * Variables:
 *   {{contract_number}}       Sequential contract reference (e.g. "2026-001")
 *   {{city}}                  City where the contract is signed
 *   {{document_date}}         Full date (e.g. "14 de marzo de 2026")
 *   {{lawyer_firm}}           Law firm name
 *   {{lawyer_name}}           Full name of the attorney (first party)
 *   {{lawyer_document_number}} Attorney's ID number
 *   {{lawyer_card_number}}    Professional card number
 *   {{lawyer_address}}        Law firm address
 *   {{client_name}}           Full name of the client (second party)
 *   {{document_type}}         ID type
 *   {{document_number}}       Client's ID number
 *   {{client_address}}        Client's address
 *   {{client_city}}           Client's city
 *   {{client_email}}          Client's email
 *   {{client_phone}}          Client's phone number
 *   {{service_description}}   Detailed description of the legal services
 *   {{contract_value}}        Fee amount (e.g. "$ 5.000.000 COP")
 *   {{payment_terms}}         Payment conditions (e.g. "50% al inicio, 50% al finalizar")
 *   {{contract_duration}}     Duration of the contract (e.g. "6 meses")
 *   {{start_date}}            Service start date
 */

import type { DocumentTemplateDefinition } from './index';

export const LEGAL_CONTRACT: DocumentTemplateDefinition = {
  name: 'Contrato de Servicios Legales',
  type: 'legal_contract',
  variables: [
    { name: 'contract_number',        label: 'Número de contrato',               required: false },
    { name: 'city',                   label: 'Ciudad',                           required: true },
    { name: 'document_date',          label: 'Fecha',                            required: true },
    { name: 'lawyer_firm',            label: 'Nombre del bufete',                required: true },
    { name: 'lawyer_name',            label: 'Nombre del abogado',               required: true },
    { name: 'lawyer_document_number', label: 'Documento del abogado',            required: false },
    { name: 'lawyer_card_number',     label: 'Tarjeta Profesional No.',          required: true },
    { name: 'lawyer_address',         label: 'Dirección del bufete',             required: false },
    { name: 'client_name',            label: 'Nombre completo del cliente',      required: true },
    { name: 'document_type',          label: 'Tipo de documento del cliente',    required: true },
    { name: 'document_number',        label: 'Número de documento del cliente',  required: true },
    { name: 'client_address',         label: 'Dirección del cliente',            required: false },
    { name: 'client_city',            label: 'Ciudad del cliente',               required: false },
    { name: 'client_email',           label: 'Correo electrónico del cliente',   required: false },
    { name: 'client_phone',           label: 'Teléfono del cliente',             required: false },
    { name: 'service_description',    label: 'Descripción del servicio',         required: true },
    { name: 'contract_value',         label: 'Valor del contrato',               required: true },
    { name: 'payment_terms',          label: 'Condiciones de pago',              required: true },
    { name: 'contract_duration',      label: 'Duración del contrato',            required: false },
    { name: 'start_date',             label: 'Fecha de inicio',                  required: false },
  ],

  html_template: /* html */ `
    <!-- ── Header ────────────────────────────────────────────────────── -->
    <div class="doc-header">
      <div>
        <div class="firm-name">{{lawyer_firm}}</div>
        <div class="firm-subtitle">Abogados y Consultores — Servicios Jurídicos Especializados</div>
      </div>
      <div class="doc-meta">
        <div>Contrato No. {{contract_number}}</div>
        <div>{{city}}, {{document_date}}</div>
      </div>
    </div>

    <!-- ── Title ──────────────────────────────────────────────────────── -->
    <div class="document-title">Contrato de Prestación de Servicios Legales</div>

    <!-- ── Preamble ───────────────────────────────────────────────────── -->
    <div class="content">

      <p>
        En la ciudad de <strong>{{city}}</strong>, a los {{document_date}}, entre los
        suscritos a saber:
      </p>

      <!-- PRIMERA PARTE -->
      <div class="clause no-break">
        <div class="clause-number">Primera Parte — El Profesional:</div>
        <div class="info-box">
          <p>
            <strong>{{lawyer_name}}</strong>, abogado(a) en ejercicio, identificado(a)
            con documento número <strong>{{lawyer_document_number}}</strong>, titular de la
            Tarjeta Profesional No. <strong>{{lawyer_card_number}}</strong> del Consejo
            Superior de la Judicatura, actuando en nombre propio y como representante
            del despacho <strong>{{lawyer_firm}}</strong>, con domicilio en
            {{lawyer_address}}, quien en adelante se denominará
            <strong>"EL PROFESIONAL"</strong>.
          </p>
        </div>
      </div>

      <!-- SEGUNDA PARTE -->
      <div class="clause no-break">
        <div class="clause-number">Segunda Parte — El Cliente:</div>
        <div class="info-box">
          <p>
            <strong>{{client_name}}</strong>, mayor de edad, identificado(a) con
            <strong>{{document_type}}</strong> número <strong>{{document_number}}</strong>,
            con domicilio en {{client_address}}, {{client_city}},
            correo electrónico: {{client_email}}, teléfono: {{client_phone}},
            quien en adelante se denominará <strong>"EL CLIENTE"</strong>.
          </p>
        </div>
      </div>

      <p>
        Ambas partes, de forma libre, espontánea y sin ningún vicio del
        consentimiento, acuerdan celebrar el presente Contrato de Prestación de
        Servicios Legales, el cual se regirá por las siguientes cláusulas:
      </p>

      <!-- CLÁUSULA 1 -->
      <div class="clause">
        <p>
          <span class="clause-title">Cláusula Primera — Objeto del Contrato:</span>
          EL PROFESIONAL se compromete a prestar los siguientes servicios legales
          a EL CLIENTE:
        </p>
        <div class="info-box">
          <p>{{service_description}}</p>
        </div>
      </div>

      <!-- CLÁUSULA 2 -->
      <div class="clause">
        <p>
          <span class="clause-title">Cláusula Segunda — Honorarios y Forma de Pago:</span>
          EL CLIENTE se obliga a pagar a EL PROFESIONAL, por concepto de honorarios
          profesionales, la suma de <strong>{{contract_value}}</strong>, bajo las
          siguientes condiciones: <strong>{{payment_terms}}</strong>.
        </p>
        <p>
          Los pagos se realizarán mediante transferencia bancaria, consignación o el
          medio que las partes acuerden en su momento. El no pago oportuno de los
          honorarios facultará a EL PROFESIONAL para suspender la prestación del
          servicio, sin perjuicio de las acciones legales que correspondan.
        </p>
      </div>

      <!-- CLÁUSULA 3 -->
      <div class="clause">
        <p>
          <span class="clause-title">Cláusula Tercera — Duración:</span>
          El presente contrato tendrá una vigencia de <strong>{{contract_duration}}</strong>
          contados a partir del <strong>{{start_date}}</strong>, pudiendo ser prorrogado
          de mutuo acuerdo entre las partes mediante escrito firmado por ambas.
        </p>
      </div>

      <!-- CLÁUSULA 4 -->
      <div class="clause">
        <p>
          <span class="clause-title">Cláusula Cuarta — Obligaciones del Profesional:</span>
          EL PROFESIONAL se compromete a: (i) prestar los servicios con la debida
          diligencia y pericia propia de su calidad de abogado; (ii) mantener
          confidencialidad sobre toda la información del CLIENTE; (iii) informar
          oportunamente sobre el estado y avances del proceso; (iv) actuar conforme
          al Código Deontológico de la Abogacía.
        </p>
      </div>

      <!-- CLÁUSULA 5 -->
      <div class="clause">
        <p>
          <span class="clause-title">Cláusula Quinta — Obligaciones del Cliente:</span>
          EL CLIENTE se compromete a: (i) suministrar de manera oportuna la información
          y documentos requeridos por EL PROFESIONAL; (ii) pagar los honorarios en las
          fechas acordadas; (iii) informar cualquier cambio relevante que afecte el
          asunto encomendado.
        </p>
      </div>

      <!-- CLÁUSULA 6 -->
      <div class="clause">
        <p>
          <span class="clause-title">Cláusula Sexta — Terminación:</span>
          El contrato podrá darse por terminado: (i) por mutuo acuerdo; (ii) por
          incumplimiento grave de cualquiera de las partes; (iii) por decisión
          unilateral, con aviso previo de quince (15) días calendario.
        </p>
      </div>

      <!-- CLÁUSULA 7 -->
      <div class="clause">
        <p>
          <span class="clause-title">Cláusula Séptima — Confidencialidad:</span>
          Toda la información intercambiada entre las partes en el marco del
          presente contrato tendrá carácter estrictamente confidencial y no podrá
          ser divulgada a terceros sin autorización previa y escrita.
        </p>
      </div>

      <!-- CLÁUSULA 8 -->
      <div class="clause">
        <p>
          <span class="clause-title">Cláusula Octava — Ley Aplicable y Jurisdicción:</span>
          El presente contrato se rige por las leyes de la República de Colombia.
          Cualquier controversia derivada del mismo se resolverá en primera instancia
          mediante conciliación y, de no llegarse a acuerdo, ante los jueces
          competentes de la ciudad de <strong>{{city}}</strong>.
        </p>
      </div>

      <p>
        En fe de lo anterior, las partes suscriben el presente contrato en dos (2)
        ejemplares del mismo tenor y valor, a los {{document_date}}.
      </p>

    </div>

    <!-- ── Signatures ─────────────────────────────────────────────────── -->
    <div class="signatures no-break">
      <div class="signature-block">
        <div class="sig-space"></div>
        <div class="sig-line"></div>
        <div class="sig-name">{{lawyer_name}}</div>
        <div class="sig-label">T.P. No. {{lawyer_card_number}}</div>
        <div class="sig-label"><em>El Profesional</em></div>
      </div>

      <div class="signature-block">
        <div class="sig-space"></div>
        <div class="sig-line"></div>
        <div class="sig-name">{{client_name}}</div>
        <div class="sig-label">{{document_type}}: {{document_number}}</div>
        <div class="sig-label"><em>El Cliente</em></div>
      </div>
    </div>

    <!-- ── Footer ─────────────────────────────────────────────────────── -->
    <div class="doc-footer">
      Contrato No. {{contract_number}} &nbsp;·&nbsp;
      <strong>{{lawyer_firm}}</strong> &nbsp;·&nbsp;
      {{city}}, {{document_date}} &nbsp;·&nbsp; Aurali Legal Platform
    </div>
  `,
};
