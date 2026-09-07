'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Clock3, ShieldAlert, Mail, Sparkles } from 'lucide-react';
import { Logo } from '@/components/common/logo';

interface Props {
  isRejected: boolean;
  title: string;
  description: string;
  notifyByEmail: string;
  logout: string;
  logoutAction: () => Promise<void>;
}

export function PendingApprovalContent({
  isRejected,
  title,
  description,
  notifyByEmail,
  logout,
  logoutAction,
}: Props) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
      }}
      className="relative z-10 flex w-full max-w-md flex-col items-center gap-6"
    >
      <motion.div
        variants={{
          hidden: { opacity: 0, y: -10 },
          visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
        }}
      >
        <Logo variant="imagotipo" size={50} />
      </motion.div>

      <motion.div
        variants={{
          hidden: { opacity: 0, y: 18, scale: 0.97 },
          visible: {
            opacity: 1,
            y: 0,
            scale: 1,
            transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
          },
        }}
        className={
          isRejected
            ? 'w-full overflow-hidden rounded-3xl border border-rose-500/20 bg-white/85 shadow-[0_30px_60px_-30px_rgba(30,27,75,0.35)] backdrop-blur-xl dark:border-rose-400/20 dark:bg-white/[0.04]'
            : 'w-full overflow-hidden rounded-3xl border border-violet-600/20 bg-white/85 shadow-[0_30px_60px_-30px_rgba(30,27,75,0.35)] backdrop-blur-xl dark:border-violet-400/20 dark:bg-white/[0.04]'
        }
      >
        <div className="flex flex-col items-center gap-5 px-8 py-10 text-center">
          <motion.div
            variants={{
              hidden: { opacity: 0, scale: 0.6 },
              visible: {
                opacity: 1,
                scale: 1,
                transition: { duration: 0.5, ease: 'backOut' },
              },
            }}
            animate={!isRejected ? { scale: [1, 1.06, 1] } : undefined}
            transition={
              !isRejected
                ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }
                : undefined
            }
            className={
              isRejected
                ? 'relative flex size-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400'
                : 'relative flex size-16 items-center justify-center rounded-2xl bg-violet-600/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400'
            }
          >
            {isRejected ? (
              <ShieldAlert className="size-8" />
            ) : (
              <>
                <Clock3 className="size-8" />
                <motion.span
                  animate={{ rotate: [0, 15, -10, 0] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
                  className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-violet-600 text-white shadow-[0_6px_16px_-4px_rgba(124,58,237,0.7)] dark:bg-violet-500"
                >
                  <Sparkles className="size-2.5" />
                </motion.span>
              </>
            )}
          </motion.div>

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 10 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
            }}
            className="space-y-2"
          >
            <h1 className="text-2xl font-bold tracking-tight text-[#111827] dark:text-white">
              {title}
            </h1>
            <p className="text-sm leading-6 text-[#6B7280] dark:text-slate-400">{description}</p>
          </motion.div>

          {!isRejected && (
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
              }}
              className="flex items-center gap-2 rounded-full border border-violet-600/15 bg-violet-600/5 px-3.5 py-1.5 text-xs font-medium text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-300"
            >
              <Mail className="size-3.5" />
              {notifyByEmail}
            </motion.div>
          )}

          <motion.form
            variants={{
              hidden: { opacity: 0, y: 10 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
            }}
            action={logoutAction}
            className="w-full pt-2"
          >
            <Button type="submit" variant="outline" className="w-full">
              {logout}
            </Button>
          </motion.form>
        </div>
      </motion.div>
    </motion.div>
  );
}
