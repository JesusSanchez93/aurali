export type PowerInput = {
  country: 'CO';
  powerType: 'GENERAL' | 'ESPECIAL';
  grantor: {
    fullName: string;
    documentType: 'CC' | 'CE';
    documentNumber: string;
    city: string;
  };
  attorney: {
    fullName: string;
    documentNumber: string;
  };
  scope: string;
  validity?: string;
};
