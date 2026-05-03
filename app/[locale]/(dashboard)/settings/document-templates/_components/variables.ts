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
            { key: 'DOCUMENT_SLUG',         label: 'Tipo de Documento del Banco' },
            { key: 'DOCUMENT_NUMBER',       label: 'Número de Documento del Banco' },
            { key: 'LAST_4_DIGITS',         label: 'Últimos 4 Dígitos' },
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
];

/** Flat set of all static variable keys in GROUP.TYPE format — used for highlight validation */
export const STATIC_VARIABLE_KEYS: Set<string> = new Set(
    VARIABLE_GROUPS.flatMap((g) => g.variables.map((v) => `${g.key.toUpperCase()}.${v.key}`)),
);
