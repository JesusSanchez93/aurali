export type VariableDef = {
    key: string;
    label: string; // Spanish label — used for natural-language search in the autocomplete
};

export const VARIABLE_GROUPS: Array<{ key: string; label: string; variables: VariableDef[] }> = [
    {
        key: 'client',
        label: 'Cliente',
        variables: [
            { key: 'FIRST_NAME',      label: 'Nombres del cliente' },
            { key: 'LAST_NAME',       label: 'Apellido' },
            { key: 'DOCUMENT_TYPE',   label: 'Tipo de Documento' },
            { key: 'DOCUMENT_NAME',   label: 'Nombre de Documento' },
            { key: 'DOCUMENT_NUMBER', label: 'Número de Documento' },
            { key: 'EMAIL',           label: 'Email' },
            { key: 'PHONE',           label: 'Teléfono' },
            { key: 'ADDRESS',         label: 'Dirección' },
            { key: 'DOCUMENT_FRONT_IMAGE', label: 'Foto del documento (frente)' },
            { key: 'DOCUMENT_BACK_IMAGE',  label: 'Foto del documento (reverso)' },
        ],
    },
    {
        key: 'process',
        label: 'Proceso',
        variables: [
            { key: 'ID',         label: 'ID del Proceso' },
            { key: 'DATE',       label: 'Fecha del Proceso' },
            { key: 'STATUS',     label: 'Estado del Proceso' },
            { key: 'FEE_AMOUNT', label: 'Valor del Proceso' },
        ],
    },
    {
        key: 'banking',
        label: 'Banco',
        variables: [
            { key: 'NAME',                  label: 'Nombre del Banco' },
            { key: 'CODE',                  label: 'Código del Banco' },
            { key: 'DOCUMENT_SLUG',         label: 'Tipo de Documento del Banco' },
            { key: 'DOCUMENT_NUMBER',       label: 'Número de Documento del Banco' },
            { key: 'LAST_4_DIGITS',         label: 'Últimos 4 Dígitos' },
            // A diferencia de LAST_4_DIGITS (un solo string ya armado, para
            // mostrar directo en un template), PRODUCTS guarda el listado
            // completo de productos financieros afectados — por su naturaleza
            // puede tener más de un valor (el field type financial_product del
            // DFB produce un array, no un valor único).
            { key: 'PRODUCTS',              label: 'Productos Financieros Afectados' },
            { key: 'FRAUD_INCIDENT_SUMMARY', label: 'Relato de los Hechos' },
            { key: 'LEGAL_REP_FIRST_NAME',  label: 'Nombre del Representante Legal del Banco' },
            { key: 'LEGAL_REP_LAST_NAME',   label: 'Apellido del Representante Legal del Banco' },
        ],
    },
    {
        key: 'lawyer',
        label: 'Abogado',
        variables: [
            { key: 'FIRST_NAME',      label: 'Nombre del Abogado' },
            { key: 'LAST_NAME',       label: 'Apellido del Abogado' },
            { key: 'DOCUMENT_TYPE',   label: 'Tipo de Documento del Abogado' },
            { key: 'DOCUMENT_NAME',   label: 'Nombre del Documento del Abogado' },
            { key: 'DOCUMENT_NUMBER',          label: 'Número de Documento del Abogado' },
            { key: 'PROFESSIONAL_CARD_NUMBER',  label: 'Número de Tarjeta Profesional' },
            { key: 'PROFESSIONAL_CARD_COUNTRY', label: 'País de Expedición de Tarjeta Profesional' },
            { key: 'PROFESSIONAL_CARD_REGION',  label: 'Departamento de Expedición de Tarjeta Profesional' },
            { key: 'PROFESSIONAL_CARD_CITY',    label: 'Ciudad de Expedición de Tarjeta Profesional' },
            { key: 'SIGNATURE',                 label: 'Firma del Abogado (URL)' },
            { key: 'SIGNATURE_IMG',             label: 'Firma del Abogado (Imagen — solo Google Docs)' },
        ],
    },
    {
        key: 'org_rep',
        label: 'Organización',
        variables: [
            { key: 'NAME',            label: 'Nombre del Bufete' },
            { key: 'FIRST_NAME',      label: 'Nombre del Representante' },
            { key: 'LAST_NAME',       label: 'Apellido del Representante' },
            { key: 'DOCUMENT_TYPE',   label: 'Tipo de Documento del Representante' },
            { key: 'DOCUMENT_NAME',   label: 'Nombre del Documento del Representante' },
            { key: 'DOCUMENT_NUMBER', label: 'Número de Documento del Representante' },
            { key: 'EMAIL',           label: 'Email del Representante' },
        ],
    },
    // Flujo "Accidente de Tránsito / Indemnización" — igual que `banking`, estos
    // grupos no vienen de una tabla propia sino del Dynamic Form Builder (campos
    // con key ACCIDENTE__FECHA, etc.) resueltos por mergeDynamicFormResponses.
    {
        key: 'accidente',
        label: 'Accidente',
        variables: [
            { key: 'FECHA',               label: 'Fecha del Accidente' },
            { key: 'HORA',                label: 'Hora del Accidente' },
            { key: 'LUGAR',               label: 'Lugar del Accidente' },
            { key: 'AUTORIDAD_TRANSITO',  label: 'Autoridad de Tránsito que Atendió' },
            { key: 'DESCRIPCION_HECHOS',  label: 'Descripción de los Hechos' },
            { key: 'IPAT',                label: 'IPAT (Informe Policial de Accidente de Tránsito)' },
            { key: 'FOTOS',               label: 'Fotos del Accidente' },
        ],
    },
    {
        key: 'vehiculo',
        label: 'Vehículo del Cliente',
        variables: [
            { key: 'PLACA',               label: 'Placa' },
            { key: 'MARCA',               label: 'Marca' },
            { key: 'SOAT_VIGENTE',        label: '¿SOAT Vigente?' },
            { key: 'SOAT_ASEGURADORA',    label: 'Aseguradora del SOAT' },
            { key: 'TARJETA_PROPIEDAD',   label: 'Tarjeta de Propiedad' },
        ],
    },
    {
        key: 'tercero',
        label: 'Tercero Responsable',
        variables: [
            { key: 'NOMBRE',            label: 'Nombre del Tercero' },
            { key: 'CEDULA',            label: 'Cédula del Tercero' },
            { key: 'PLACA',             label: 'Placa del Vehículo del Tercero' },
            { key: 'ASEGURADORA_RC',    label: 'Aseguradora de Responsabilidad Civil' },
            { key: 'POLIZA_NUMERO',     label: 'Número de Póliza' },
        ],
    },
    {
        key: 'lesion',
        label: 'Lesiones y Atención Médica',
        variables: [
            { key: 'DESCRIPCION',         label: 'Descripción de las Lesiones' },
            { key: 'HISTORIA_CLINICA',    label: 'Historia Clínica' },
            { key: 'INCAPACIDADES',       label: 'Incapacidades Médicas' },
            { key: 'DIAS_INCAPACIDAD',    label: 'Días de Incapacidad' },
            { key: 'GASTOS_MEDICOS',      label: 'Gastos Médicos' },
            { key: 'SOPORTES_GASTOS',     label: 'Soportes de Gastos Médicos' },
        ],
    },
    {
        key: 'dano',
        label: 'Daños Materiales',
        variables: [
            { key: 'DESCRIPCION',              label: 'Descripción de los Daños' },
            { key: 'COTIZACION_REPARACION',    label: 'Cotización de Reparación' },
            { key: 'VALOR_ESTIMADO',           label: 'Valor Estimado de los Daños' },
        ],
    },
    {
        key: 'lucro',
        label: 'Lucro Cesante',
        variables: [
            { key: 'OCUPACION',              label: 'Ocupación del Cliente' },
            { key: 'INGRESO_MENSUAL',        label: 'Ingreso Mensual' },
            { key: 'DIAS_SIN_TRABAJAR',      label: 'Días sin Trabajar' },
            { key: 'CERTIFICADO_INGRESOS',   label: 'Certificado de Ingresos' },
        ],
    },
    // Flujo "Derecho Laboral - Despido / Indemnización" — mismo mecanismo que
    // `accidente`/`banking`: resueltos por mergeDynamicFormResponses, no por
    // una tabla propia.
    {
        key: 'empleador',
        label: 'Empleador',
        variables: [
            { key: 'RAZON_SOCIAL',          label: 'Razón Social del Empleador' },
            { key: 'NIT',                   label: 'NIT del Empleador' },
            { key: 'REPRESENTANTE_LEGAL',   label: 'Representante Legal del Empleador' },
            { key: 'DIRECCION',             label: 'Dirección del Empleador' },
            { key: 'EMAIL',                 label: 'Correo del Empleador' },
        ],
    },
    {
        key: 'contrato',
        label: 'Contrato de Trabajo',
        variables: [
            { key: 'TIPO',                  label: 'Tipo de Contrato' },
            { key: 'CARGO',                 label: 'Cargo Desempeñado' },
            { key: 'FECHA_INICIO',          label: 'Fecha de Inicio del Contrato' },
            { key: 'FECHA_TERMINACION',     label: 'Fecha de Terminación del Contrato' },
            { key: 'SALARIO',               label: 'Salario Mensual' },
            { key: 'COPIA',                 label: 'Copia del Contrato' },
        ],
    },
    {
        key: 'despido',
        label: 'Despido',
        variables: [
            { key: 'FECHA',                    label: 'Fecha del Despido' },
            { key: 'CONSIDERA_INJUSTO',        label: '¿Despido sin Justa Causa?' },
            { key: 'MOTIVO_ALEGADO',           label: 'Motivo Alegado por el Empleador' },
            { key: 'FUERO',                    label: 'Estabilidad Laboral Reforzada (Fuero)' },
            { key: 'CARTA_TERMINACION',        label: 'Carta de Terminación' },
        ],
    },
    {
        key: 'prestaciones',
        label: 'Prestaciones Pendientes',
        variables: [
            { key: 'LIQUIDACION_RECIBIDA',      label: '¿Recibió Liquidación?' },
            { key: 'SOPORTE_LIQUIDACION',       label: 'Soporte de la Liquidación' },
            { key: 'SALARIOS_PENDIENTES',       label: 'Salarios Pendientes' },
            { key: 'CESANTIAS_PENDIENTES',      label: 'Cesantías Pendientes' },
            { key: 'PRIMA_PENDIENTE',           label: 'Prima de Servicios Pendiente' },
            { key: 'VACACIONES_PENDIENTES',     label: 'Vacaciones Pendientes' },
        ],
    },
    // Flujo "Divorcios" (mutuo acuerdo ante notaría) — mismo mecanismo que
    // `accidente`/`empleador`: resueltos por mergeDynamicFormResponses.
    {
        key: 'matrimonio',
        label: 'Matrimonio',
        variables: [
            { key: 'FECHA',                  label: 'Fecha del Matrimonio' },
            { key: 'NOTARIA_REGISTRO',       label: 'Notaría/Registro del Matrimonio' },
            { key: 'NUMERO_ESCRITURA',       label: 'Número de Escritura/Registro Civil' },
            { key: 'REGIMEN_PATRIMONIAL',    label: 'Régimen Patrimonial' },
            { key: 'REGISTRO_CIVIL',         label: 'Registro Civil de Matrimonio' },
        ],
    },
    {
        key: 'conyuge',
        label: 'Cónyuge',
        variables: [
            { key: 'NOMBRE',                    label: 'Nombre del Cónyuge' },
            { key: 'DOCUMENTO',                 label: 'Documento del Cónyuge' },
            { key: 'DIRECCION',                 label: 'Dirección del Cónyuge' },
            { key: 'ACEPTA_MUTUO_ACUERDO',      label: '¿Cónyuge Acepta Mutuo Acuerdo?' },
        ],
    },
    {
        key: 'hijos',
        label: 'Hijos y Custodia',
        variables: [
            { key: 'TIENE_MENORES',           label: '¿Tiene Hijos Menores?' },
            { key: 'CANTIDAD',                label: 'Número de Hijos' },
            { key: 'REGISTROS_CIVILES',       label: 'Registros Civiles de los Hijos' },
            { key: 'ACUERDO_CUSTODIA',        label: 'Acuerdo de Custodia' },
            { key: 'ACUERDO_VISITAS',         label: 'Acuerdo de Visitas' },
            { key: 'CUOTA_ALIMENTOS',         label: 'Cuota de Alimentos' },
            { key: 'ACUERDO_FIRMADO',         label: 'Acuerdo Firmado' },
        ],
    },
    {
        key: 'bienes',
        label: 'Bienes y Sociedad Conyugal',
        variables: [
            { key: 'TIENE_BIENES',              label: '¿Hay Bienes en la Sociedad Conyugal?' },
            { key: 'DESCRIPCION',               label: 'Descripción de los Bienes' },
            { key: 'LIQUIDAR_MISMO_ACTO',       label: '¿Liquidar en el Mismo Acto?' },
        ],
    },
];

/** Flat set of all static variable keys in GROUP.TYPE format — used for highlight validation */
export const STATIC_VARIABLE_KEYS: Set<string> = new Set(
    VARIABLE_GROUPS.flatMap((g) => g.variables.map((v) => `${g.key.toUpperCase()}.${v.key}`)),
);
