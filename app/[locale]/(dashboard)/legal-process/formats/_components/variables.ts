export type VariableDef = {
    key: string;
    label: string; // Spanish label — used for natural-language search in the autocomplete
};

export const VARIABLE_GROUPS: Array<{ key: string; variables: VariableDef[] }> = [
    {
        key: 'client',
        variables: [
            { key: 'FIRST_NAME',       label: 'Nombre' },
            { key: 'LAST_NAME',        label: 'Apellido' },
            { key: 'DOCUMENT_TYPE',    label: 'Tipo de Documento' },
            { key: 'DOCUMENT_NAME',    label: 'Nombre de Documento' },
            { key: 'DOCUMENT_NUMBER',  label: 'Número de Documento' },
            { key: 'EMAIL',            label: 'Email' },
            { key: 'PHONE',            label: 'Teléfono' },
            { key: 'ADDRESS',          label: 'Dirección' },
        ],
    },
    {
        key: 'process',
        variables: [
            { key: 'PROCESS_ID',     label: 'ID del Proceso' },
            { key: 'PROCESS_DATE',   label: 'Fecha del Proceso' },
            { key: 'PROCESS_STATUS', label: 'Estado del Proceso' },
            { key: 'FEE_AMOUNT',     label: 'Valor del Proceso' },
        ],
    },
    {
        key: 'banking',
        variables: [
            { key: 'BANK_NAME',              label: 'Nombre del Banco' },
            { key: 'BANK_DOCUMENT_SLUG',     label: 'Tipo de Documento del Banco' },
            { key: 'BANK_DOCUMENT_NUMBER',   label: 'Número de Documento del Banco' },
            { key: 'BANK_LAST_4_DIGITS',     label: 'Últimos 4 Dígitos' },
            { key: 'FRAUD_INCIDENT_SUMMARY', label: 'Relato de los Hechos' },
        ],
    },
    {
        key: 'lawyer',
        variables: [
            { key: 'LAWYER_FIRST_NAME',      label: 'Nombre del Abogado' },
            { key: 'LAWYER_LAST_NAME',       label: 'Apellido del Abogado' },
            { key: 'LAWYER_DOCUMENT_TYPE',   label: 'Tipo de Documento del Abogado' },
            { key: 'LAWYER_DOCUMENT_NAME',   label: 'Nombre del Documento del Abogado' },
            { key: 'LAWYER_DOCUMENT_NUMBER', label: 'Número de Documento del Abogado' },
            { key: 'LAWYER_SIGNATURE',       label: 'Firma del Abogado' },
        ],
    },
    {
        key: 'org_rep',
        variables: [
            { key: 'ORG_REP_FIRST_NAME',      label: 'Nombre del Representante' },
            { key: 'ORG_REP_LAST_NAME',       label: 'Apellido del Representante' },
            { key: 'ORG_REP_DOCUMENT_TYPE',   label: 'Tipo de Documento del Representante' },
            { key: 'ORG_REP_DOCUMENT_NAME',   label: 'Nombre del Documento del Representante' },
            { key: 'ORG_REP_DOCUMENT_NUMBER', label: 'Número de Documento del Representante' },
            { key: 'ORG_REP_EMAIL',           label: 'Email del Representante' },
            { key: 'ORG_NAME',                label: 'Nombre del Bufete' },
        ],
    },
];
