export const VARIABLE_GROUPS = [
    {
        key: 'client',
        variables: [
            'FIRST_NAME',
            'LAST_NAME',
            'DOCUMENT_TYPE',
            'DOCUMENT_NAME',
            'DOCUMENT_NUMBER',
            'EMAIL',
            'PHONE',
            'ADDRESS',
        ],
    },
    {
        key: 'process',
        variables: [
            'PROCESS_ID',
            'PROCESS_DATE',
            'PROCESS_STATUS',
        ],
    },
    {
        key: 'banking',
        variables: [
            'BANK_NAME',
            'BANK_DOCUMENT_SLUG',
            'BANK_DOCUMENT_NUMBER',
            'BANK_LAST_4_DIGITS',
            'FRAUD_INCIDENT_SUMMARY',
        ],
    },
    {
        key: 'lawyer',
        variables: [
            'LAWYER_FIRST_NAME',
            'LAWYER_LAST_NAME',
            'LAWYER_DOCUMENT_TYPE',
            'LAWYER_DOCUMENT_NAME',
            'LAWYER_DOCUMENT_NUMBER',
        ],
    },
    {
        key: 'org_rep',
        variables: [
            'ORG_REP_FIRST_NAME',
            'ORG_REP_LAST_NAME',
            'ORG_REP_DOCUMENT_TYPE',
            'ORG_REP_DOCUMENT_NAME',
            'ORG_REP_DOCUMENT_NUMBER',
            'ORG_REP_EMAIL',
            'ORG_NAME',
        ],
    },
] as const;
