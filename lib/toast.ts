import { toast as sonnerToast } from 'sonner';

interface ToastOptions {
  description?: string;
}

export const toast = {
  success: (message: string, options?: ToastOptions) =>
    sonnerToast.success(message, { description: options?.description }),
  error: (message: string, options?: ToastOptions) =>
    sonnerToast.error(message, { description: options?.description }),
  loading: (message: string, options?: ToastOptions) =>
    sonnerToast.loading(message, { description: options?.description }),
  dismiss: (id: string | number) => sonnerToast.dismiss(id),
};
