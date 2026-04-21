/** One variable within a group, e.g. { key: 'FIRST_NAME', label: 'Nombres del cliente' } */
export type VariableDef = {
    key: string;
    label: string;
};

/** A named group of variables, e.g. { key: 'client', label: 'Cliente', variables: [...] } */
export type VariableGroup = {
    key: string;
    label: string;
    variables: VariableDef[];
};
