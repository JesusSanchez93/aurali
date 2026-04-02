'use client';

import { CheckCircle } from 'lucide-react';

export default function SuccessForm() {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-6">
            <div className="flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-950">
                <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>

            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
                ¡Formulario completado exitosamente!
            </h2>

            <p className="text-gray-500 dark:text-gray-400 max-w-md">
                Tu información ha sido enviada correctamente. Nos pondremos en contacto contigo pronto.
            </p>

            <div className="mt-4 text-sm text-gray-400 dark:text-gray-500">
                Puedes cerrar esta ventana.
            </div>
        </div>
    );
}
