'use client';

import { motion } from 'framer-motion';
import { LoaderCircle, ShieldCheck, Sparkles } from 'lucide-react';

interface AppLoadingFallbackProps {
  label: string;
  description: string;
}

export function AppLoadingFallback({ label, description }: AppLoadingFallbackProps) {
  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.18),_transparent_34%),linear-gradient(180deg,_#f8fafc_0%,_#f5f3ff_45%,_#eef2ff_100%)] px-6 py-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,_rgba(30,27,75,0.08)_1px,_transparent_0)] [background-size:22px_22px]" />
      <motion.div
        className="absolute left-[12%] top-[20%] h-24 w-24 rounded-full bg-[rgba(124,58,237,0.14)] blur-3xl"
        animate={{ y: [0, -10, 0], x: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-[18%] right-[10%] h-28 w-28 rounded-full bg-[rgba(245,158,11,0.14)] blur-3xl"
        animate={{ y: [0, 12, 0], x: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 7, ease: 'easeInOut' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-3xl"
        style={{ willChange: 'transform, opacity' }}
      >
        <div className="rounded-[32px] border border-white/60 bg-white/78 p-6 shadow-[0_35px_80px_-34px_rgba(30,27,75,0.38)] backdrop-blur-xl sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(124,58,237,0.15)] bg-white/80 px-4 py-2 text-sm font-semibold text-indigo-950">
                <Sparkles className="h-4 w-4 text-violet-600" />
                Aurali
              </div>

              <div className="space-y-3">
                <h2 className="max-w-[12ch] text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                  {label}
                </h2>
                <p className="max-w-lg text-sm leading-7 text-slate-600 sm:text-base">
                  {description}
                </p>
              </div>

              <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-950 text-white">
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{label}</p>
                  <p className="text-xs text-slate-500">Inicializando entorno seguro</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
                className="rounded-3xl border border-slate-100 bg-white/90 p-5 shadow-[0_24px_50px_-36px_rgba(15,23,42,0.42)]"
                style={{ willChange: 'transform, opacity' }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-600">
                      Acceso protegido
                    </p>
                    <h3 className="mt-2 text-xl font-bold tracking-tight text-indigo-950">
                      Verificando tu sesión
                    </h3>
                  </div>
                  <ShieldCheck className="h-6 w-6 text-emerald-500" />
                </div>

                <div className="space-y-3">
                  {[72, 58, 84].map((width, index) => (
                    <div key={width} className="space-y-2">
                      <div className="h-3 w-32 rounded-full bg-slate-200/90" />
                      <div className="h-2.5 rounded-full bg-slate-100">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-950 via-violet-600 to-amber-400"
                          initial={{ width: 0 }}
                          animate={{ width: `${width}%` }}
                          transition={{ duration: 1.1, delay: 0.2 + index * 0.15, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
