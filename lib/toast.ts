import { sileo } from 'sileo';

interface ToastOptions {
  description?: string;
}

export const toast = {
  success: (message: string, options?: ToastOptions) =>
    sileo.success({ title: message, description: options?.description }),
  error: (message: string, options?: ToastOptions) =>
    sileo.error({ title: message, description: options?.description }),
  loading: (message: string, options?: ToastOptions) =>
    sileo.show({ type: 'loading', title: message, description: options?.description }),
  dismiss: (id: string) => sileo.dismiss(id),
};
