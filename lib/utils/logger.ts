/**
 * logger.ts
 *
 * Centralized structured logger for Aurali.
 *
 * Usage:
 *   const logger = createLogger('PDF_GENERATION');
 *   logger.info('Starting PDF generation', { contentLength: html.length });
 *   logger.error('PDF generation failed', error, { templateId });
 *
 * Levels:
 *   debug  — only emitted in development (NODE_ENV=development)
 *   info   — always emitted
 *   warn   — always emitted
 *   error  — always emitted; includes structured error details
 */

type LogContext = Record<string, unknown>;

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: unknown, context?: LogContext): void;
}

export function createLogger(name: string): Logger {
  const prefix = `[${name}]`;
  const isDev = process.env.NODE_ENV === 'development';

  return {
    debug(message, context) {
      if (!isDev) return;
      if (context && Object.keys(context).length > 0) {
        console.debug(prefix, message, context);
      } else {
        console.debug(prefix, message);
      }
    },

    info(message, context) {
      if (context && Object.keys(context).length > 0) {
        console.info(prefix, message, context);
      } else {
        console.info(prefix, message);
      }
    },

    warn(message, context) {
      if (context && Object.keys(context).length > 0) {
        console.warn(prefix, message, context);
      } else {
        console.warn(prefix, message);
      }
    },

    error(message, error, context) {
      const errorDetails =
        error instanceof Error
          ? { message: error.message, name: error.name, stack: error.stack }
          : error !== undefined
            ? { raw: error }
            : undefined;

      const payload = {
        ...(context ?? {}),
        ...(errorDetails ? { error: errorDetails } : {}),
      };

      if (Object.keys(payload).length > 0) {
        console.error(prefix, message, payload);
      } else {
        console.error(prefix, message);
      }
    },
  };
}
