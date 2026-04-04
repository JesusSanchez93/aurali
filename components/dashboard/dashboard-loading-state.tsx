'use client';

import { motion } from 'framer-motion';
import { Bot, FileText, LoaderCircle, Sparkles, Workflow } from 'lucide-react';
import { useTranslations } from 'next-intl';

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
};

const workflowSteps = [
  { icon: Workflow, width: '72%' },
  { icon: Bot, width: '58%' },
  { icon: FileText, width: '84%' },
];

export function DashboardLoadingState() {
  const t = useTranslations('common');

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.18),_transparent_34%),linear-gradient(180deg,_#f8fafc_0%,_#f5f3ff_45%,_#eef2ff_100%)] px-6 py-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,_rgba(30,27,75,0.08)_1px,_transparent_0)] [background-size:22px_22px]" />
      <motion.div
        className="absolute left-[14%] top-[20%] h-24 w-24 rounded-full bg-[rgba(124,58,237,0.12)] blur-3xl"
        animate={{ y: [0, -12, 0], x: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-[16%] right-[10%] h-28 w-28 rounded-full bg-[rgba(245,158,11,0.14)] blur-3xl"
        animate={{ y: [0, 10, 0], x: [0, -10, 0] }}
        transition={{ repeat: Infinity, duration: 7, ease: 'easeInOut' }}
      />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 grid w-full max-w-5xl gap-8 lg:grid-cols-[0.95fr_1.05fr]"
      >
        <motion.div variants={itemVariants} className="space-y-6">
          <motion.div
            variants={itemVariants}
            className="inline-flex items-center gap-2 rounded-full border border-[rgba(124,58,237,0.15)] bg-white/70 px-4 py-2 text-sm font-semibold text-indigo-950 backdrop-blur"
          >
            <Sparkles className="h-4 w-4 text-violet-600" />
            Aurali
          </motion.div>

          <motion.div variants={itemVariants} className="space-y-4">
            <h1 className="max-w-[12ch] text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
              Preparando tu espacio de trabajo legal
            </h1>
            <p className="max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              Estamos cargando tu organización, permisos y procesos activos para llevarte directo al panel con todo listo.
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-950 text-white shadow-[0_18px_35px_-22px_rgba(30,27,75,0.8)]">
              <LoaderCircle className="h-5 w-5 animate-spin" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{t('loading')}</p>
              <p className="text-sm text-slate-500">Sincronizando tu sesión segura</p>
            </div>
          </motion.div>
        </motion.div>

        <motion.div variants={itemVariants} className="relative">
          <div className="rounded-[32px] border border-white/60 bg-white/72 p-5 shadow-[0_35px_80px_-34px_rgba(30,27,75,0.38)] backdrop-blur-xl sm:p-7">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-600">
                  Vista operativa
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-indigo-950">
                  Motor de automatización
                </h2>
              </div>
              <div className="rounded-full bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700">
                Activo
              </div>
            </div>

            <div className="space-y-4">
              {workflowSteps.map((step, index) => {
                const Icon = step.icon;

                return (
                  <motion.div
                    key={index}
                    variants={itemVariants}
                    className="rounded-3xl border border-slate-100 bg-white/90 p-4 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.42)]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-indigo-950">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="h-3 w-40 rounded-full bg-slate-200/90 sm:w-52" />
                        <div className="h-2.5 rounded-full bg-slate-100">
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-950 via-violet-600 to-amber-400"
                            initial={{ width: 0 }}
                            animate={{ width: step.width }}
                            transition={{ duration: 1.1, delay: 0.2 + index * 0.15, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <motion.div
              variants={itemVariants}
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Configuración segura en progreso
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
