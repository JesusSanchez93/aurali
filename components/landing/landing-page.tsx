'use client';

import { AnimatePresence, LayoutGroup, animate, motion, useInView, useMotionValue, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Brain,
  FileText,
  Gavel,
  Landmark,
  Menu,
  Quote,
  Scale,
  Sparkles,
  X,
  Zap,
  Users,
  FolderKanban,
  MessageSquareWarning,
  Files,
  Eye,
  CheckCircle2,
  Bot,
  MailCheck,
  FileBadge2,
  Languages,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { useParams } from 'next/navigation';
import { ES, GB } from 'country-flag-icons/react/3x2';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/common/logo';
import { ThemeSwitcher } from '@/components/app/theme-switcher';

const entryTransition = { duration: 0.5, ease: 'easeOut' as const };
const sectionViewport = { once: true, margin: '-80px' };
const itemMotion = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: sectionViewport,
  transition: entryTransition,
};
const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};
const staggerItem = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: entryTransition,
  },
};

const legalIcons = [Scale, Gavel, FileText, Landmark];

export function LandingPage({
  isLoggedIn = false,
  platformHref = '/dashboard',
}: {
  isLoggedIn?: boolean;
  platformHref?: '/dashboard' | '/onboarding';
}) {
  const t = useTranslations('landing');
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const sectionIds = ['features', 'benefits', 'how-it-works', 'pricing'];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection('#' + entry.target.id);
        });
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: 0 },
    );
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      document.body.style.overflow = '';
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  const navLinks = useMemo(
    () => [
      { href: '#features', label: t('nav.features') },
      { href: '#how-it-works', label: t('nav.howItWorks') },
      { href: '#benefits', label: t('nav.benefits') },
      { href: '#pricing', label: t('nav.pricing') },
    ],
    [t],
  );

  const painPoints = useMemo(
    () => [
      {
        icon: MessageSquareWarning,
        title: t('problem.cards.manual.title'),
        description: t('problem.cards.manual.description'),
      },
      {
        icon: Files,
        title: t('problem.cards.repetitive.title'),
        description: t('problem.cards.repetitive.description'),
      },
      {
        icon: Eye,
        title: t('problem.cards.visibility.title'),
        description: t('problem.cards.visibility.description'),
      },
    ],
    [t],
  );

  const features = useMemo(
    () => [
      { icon: Zap, title: t('features.items.workflows.title'), description: t('features.items.workflows.description') },
      { icon: FileText, title: t('features.items.documents.title'), description: t('features.items.documents.description') },
      { icon: Brain, title: t('features.items.ai.title'), description: t('features.items.ai.description') },
      { icon: Users, title: t('features.items.multiLawyer.title'), description: t('features.items.multiLawyer.description') },
      { icon: Bell, title: t('features.items.notifications.title'), description: t('features.items.notifications.description') },
      { icon: BarChart3, title: t('features.items.visibility.title'), description: t('features.items.visibility.description') },
    ],
    [t],
  );

  const steps = useMemo(
    () => [
      { title: t('howItWorks.steps.step1.title'), description: t('howItWorks.steps.step1.description') },
      { title: t('howItWorks.steps.step2.title'), description: t('howItWorks.steps.step2.description') },
      { title: t('howItWorks.steps.step3.title'), description: t('howItWorks.steps.step3.description') },
      { title: t('howItWorks.steps.step4.title'), description: t('howItWorks.steps.step4.description') },
    ],
    [t],
  );

  const testimonials = useMemo(
    () => [
      { quote: t('testimonials.items.one.quote'), extended: t('testimonials.items.one.extended'), author: t('testimonials.items.one.author'), role: t('testimonials.items.one.role') },
      { quote: t('testimonials.items.two.quote'), extended: t('testimonials.items.two.extended'), author: t('testimonials.items.two.author'), role: t('testimonials.items.two.role') },
      { quote: t('testimonials.items.three.quote'), extended: t('testimonials.items.three.extended'), author: t('testimonials.items.three.author'), role: t('testimonials.items.three.role') },
    ],
    [t],
  );

  const benefits = useMemo(
    () => [
      t('benefits.list.one'),
      t('benefits.list.two'),
      t('benefits.list.three'),
      t('benefits.list.four'),
    ],
    [t],
  );

  return (
    <div
      className="min-h-screen bg-[var(--landing-bg)] text-[var(--landing-text)]"
      style={{
        ['--landing-primary' as string]: '#1E1B4B',
        ['--landing-accent' as string]: '#7C3AED',
        ['--landing-highlight' as string]: '#F59E0B',
      }}
    >
      <LandingNav
        links={navLinks}
        scrolled={scrolled}
        menuOpen={menuOpen}
        isLoggedIn={isLoggedIn}
        platformHref={platformHref}
        activeSection={activeSection}
        onMenuToggle={() => setMenuOpen((value) => !value)}
        onClose={() => setMenuOpen(false)}
      />

      <main className="overflow-x-clip">
        <HeroSection t={t} />
        <SocialProofBar t={t} />
        <ProblemSection t={t} painPoints={painPoints} />
        <FeaturesSection t={t} features={features} />
        <HowItWorksSection t={t} steps={steps} />
        <BenefitsSection t={t} benefits={benefits} />
        <TestimonialsSection t={t} testimonials={testimonials} />
        <FinalCtaSection t={t} />
      </main>

      <LandingFooter t={t} />
    </div>
  );
}

type LinkItem = { href: string; label: string };

type Translator = ReturnType<typeof useTranslations>;

function LandingNav({
  links,
  scrolled,
  menuOpen,
  isLoggedIn,
  platformHref,
  activeSection,
  onMenuToggle,
  onClose,
}: {
  links: LinkItem[];
  scrolled: boolean;
  menuOpen: boolean;
  isLoggedIn: boolean;
  platformHref: '/dashboard' | '/onboarding';
  activeSection: string;
  onMenuToggle: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('landing');
  const accessHref = isLoggedIn ? platformHref : '/auth/login';
  const accessLabel = isLoggedIn ? t('nav.platformCta') : t('nav.cta');

  function scrollToSection(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    const id = href.replace('#', '');
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-all duration-300',
          scrolled
            ? 'border-b border-black/5 bg-white/80 shadow-[0_12px_40px_-28px_rgba(30,27,75,0.35)] backdrop-blur-md dark:border-white/10 dark:bg-black/40'
            : 'bg-transparent',
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Aurali home">
            <Logo size={36} />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            <LayoutGroup id="landing-nav">
              {links.map((link) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => scrollToSection(e, link.href)}
                  className="relative rounded-full px-4 py-2 text-sm font-medium transition-colors hover:text-[var(--landing-primary)] dark:hover:text-white"
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 600, damping: 20 }}
                >
                  {activeSection === link.href && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-full bg-[rgba(30,27,75,0.07)] dark:bg-white/10"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span
                    className={cn(
                      'relative z-10 transition-colors',
                      activeSection === link.href
                        ? 'text-[var(--landing-primary)] dark:text-white'
                        : 'text-[color:var(--landing-muted)]',
                    )}
                  >
                    {link.label}
                  </span>
                </motion.a>
              ))}
            </LayoutGroup>
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <LandingLanguageSwitcher />
            <ThemeSwitcher />
            <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }} style={{ willChange: 'transform' }}>
              <Button
                asChild
                className="rounded-full border-0 bg-[var(--landing-highlight)] px-6 text-[#1E1B4B] shadow-[0_16px_30px_-18px_rgba(245,158,11,0.8)] hover:bg-[#f8ab27]"
              >
                <Link href={accessHref}>{accessLabel}</Link>
              </Button>
            </motion.div>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <ThemeSwitcher />
            <button
              type="button"
              onClick={onMenuToggle}
              aria-label={t('nav.mobileAria')}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/80 text-[var(--landing-primary)] shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10 dark:text-white"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="fixed inset-x-0 bottom-0 top-[76px] z-40 bg-white/18 backdrop-blur-md lg:hidden dark:bg-black/40"
              style={{ willChange: 'opacity' }}
              onClick={onClose}
            />
            <motion.div
              initial={{ opacity: 0, y: -18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={entryTransition}
              className="fixed inset-x-0 top-[76px] z-50 border-t border-black/5 bg-white/95 px-4 pb-6 pt-3 shadow-lg backdrop-blur lg:hidden dark:border-white/10 dark:bg-[#0d0d12]/98"
              style={{ willChange: 'transform, opacity' }}
            >
              <div className="mx-auto flex max-w-7xl flex-col gap-2">
                <div className="mb-2 flex justify-start">
                  <LandingLanguageSwitcher />
                </div>
                {links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => { scrollToSection(e, link.href); onClose(); }}
                    className="rounded-2xl px-4 py-3 text-sm font-medium text-[var(--landing-primary)] hover:bg-[rgba(124,58,237,0.08)] dark:text-white dark:hover:bg-white/10"
                  >
                    {link.label}
                  </a>
                ))}
                <Button
                  asChild
                  className="mt-2 rounded-full border-0 bg-[var(--landing-highlight)] text-[#1E1B4B] hover:bg-[#f8ab27]"
                >
                  <Link href={accessHref}>{accessLabel}</Link>
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function LandingLanguageSwitcher() {
  const t = useTranslations('landing');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  function onLocaleChange(nextLocale: string) {
    router.replace(
      // @ts-expect-error -- TypeScript doesn't know that the params match the pathname
      { pathname, params },
      { locale: nextLocale },
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-11 gap-2 rounded-full border-black/10 bg-white/80 px-3 text-[var(--landing-primary)] shadow-sm backdrop-blur hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
          aria-label={t('nav.language')}
        >
          <div className="h-5 w-5 overflow-hidden rounded-full border border-black/10 shadow-sm">
            <div className="flex h-full w-full scale-[1.5] items-center justify-center">
              {locale === 'es' ? <ES /> : <GB />}
            </div>
          </div>
          <span className="text-xs font-semibold uppercase">{locale}</span>
          <Languages className="h-3.5 w-3.5 text-[var(--landing-muted)]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-44 rounded-2xl border border-black/5 bg-white/95 p-1 shadow-[0_16px_40px_-24px_rgba(30,27,75,0.35)] backdrop-blur dark:border-white/10 dark:bg-[#13111a]/95"
      >
        <DropdownMenuItem
          onClick={() => onLocaleChange('es')}
          disabled={locale === 'es'}
          className={cn(
            'cursor-pointer gap-3 rounded-xl py-2.5',
            locale === 'es' && 'bg-[rgba(124,58,237,0.08)] font-semibold text-[var(--landing-primary)] dark:bg-violet-500/20 dark:text-white',
          )}
        >
          <div className="h-5 w-5 overflow-hidden rounded-full border border-black/10 shadow-sm">
            <div className="flex h-full w-full scale-[1.5] items-center justify-center">
              <ES />
            </div>
          </div>
          <span className="text-sm">{t('nav.languages.es')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onLocaleChange('en')}
          disabled={locale === 'en'}
          className={cn(
            'cursor-pointer gap-3 rounded-xl py-2.5',
            locale === 'en' && 'bg-[rgba(124,58,237,0.08)] font-semibold text-[var(--landing-primary)] dark:bg-violet-500/20 dark:text-white',
          )}
        >
          <div className="h-5 w-5 overflow-hidden rounded-full border border-black/10 shadow-sm">
            <div className="flex h-full w-full scale-[1.5] items-center justify-center">
              <GB />
            </div>
          </div>
          <span className="text-sm">{t('nav.languages.en')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function HeroSection({ t }: { t: Translator }) {
  const reducedMotion = useReducedMotion();
  const processSteps = [
    { icon: FolderKanban, label: t('hero.visual.steps.intake') },
    { icon: Bot, label: t('hero.visual.steps.generation') },
    { icon: MailCheck, label: t('hero.visual.steps.notification') },
    { icon: FileBadge2, label: t('hero.visual.steps.review') },
  ];

  const trustStats = [
    { value: '80%', label: t('benefits.stats.time') },
    { value: '3x', label: t('benefits.stats.capacity') },
  ];

  return (
    <section
      className="relative isolate overflow-hidden px-4 pb-20 pt-32 sm:px-6 sm:pt-36 lg:px-8 lg:pb-28"
      style={{
        backgroundImage:
          'radial-gradient(circle at 1px 1px, rgba(30,27,75,0.11) 1px, transparent 0), linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(250,250,250,1) 58%, rgba(245,243,255,0.55) 100%)',
        backgroundSize: '22px 22px, auto',
      }}
    >
      <div
        className="absolute inset-0 -z-20 hidden dark:block"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.07) 1px, transparent 0), linear-gradient(180deg, #0a0a0f 0%, #0d0d12 58%, #12101c 100%)',
          backgroundSize: '22px 22px, auto',
        }}
      />
      <div className="absolute inset-x-0 top-20 -z-10 h-[32rem] bg-[radial-gradient(circle,_rgba(124,58,237,0.18)_0%,_rgba(124,58,237,0)_62%)] blur-3xl dark:bg-[radial-gradient(circle,_rgba(124,58,237,0.28)_0%,_rgba(124,58,237,0)_62%)]" />
      <div className="absolute right-[-8rem] top-40 -z-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,_rgba(245,158,11,0.18)_0%,_rgba(245,158,11,0)_65%)] blur-3xl dark:bg-[radial-gradient(circle,_rgba(245,158,11,0.14)_0%,_rgba(245,158,11,0)_65%)]" />

      <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="max-w-2xl space-y-8 lg:pl-1"
        >
          <motion.div variants={staggerItem} style={{ willChange: 'transform, opacity' }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(124,58,237,0.16)] bg-white/72 px-4 py-2 text-sm font-medium text-[var(--landing-primary)] backdrop-blur dark:border-violet-400/20 dark:bg-white/5 dark:text-white">
              <Sparkles className="h-4 w-4 text-[var(--landing-accent)] dark:text-violet-300" />
              {t('hero.eyebrow')}
            </span>
          </motion.div>

          <motion.div variants={staggerItem} style={{ willChange: 'transform, opacity' }}>
            <h1 className="max-w-[13ch] text-5xl font-bold tracking-tight text-[var(--landing-text)] sm:text-6xl lg:text-[5.25rem] lg:leading-[1.02]">
              {t('hero.titleLine1')}
              <span className="mt-1 block bg-gradient-to-r from-[var(--landing-primary)] via-[var(--landing-accent)] to-[var(--landing-primary)] bg-clip-text text-transparent dark:from-white dark:via-violet-300 dark:to-white">
                {t('hero.titleLine2')}
              </span>
            </h1>
          </motion.div>

          <motion.p
            variants={staggerItem}
            style={{ willChange: 'transform, opacity' }}
            className="max-w-2xl text-lg leading-relaxed text-[var(--landing-muted)] sm:text-xl"
          >
            {t('hero.subtitle')}
          </motion.p>

          <motion.div
            variants={staggerItem}
            style={{ willChange: 'transform, opacity' }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }} style={{ willChange: 'transform' }}>
              <Button
                asChild
                size="lg"
                className="w-full rounded-full border-0 bg-[var(--landing-highlight)] px-7 text-[#1E1B4B] shadow-[0_22px_40px_-22px_rgba(245,158,11,0.9)] hover:bg-[#f8ab27] sm:w-auto"
              >
                <Link href="/auth/login">{t('hero.primaryCta')}</Link>
              </Button>
            </motion.div>
            <motion.a
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.2 }}
              href="#how-it-works"
              onClick={(e) => { e.preventDefault(); document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
              style={{ willChange: 'transform', cursor: 'pointer' }}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white/80 px-7 py-3 text-sm font-medium text-[var(--landing-primary)] shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10 dark:text-white"
            >
              {t('hero.secondaryCta')}
              <ArrowRight className="h-4 w-4" />
            </motion.a>
          </motion.div>

          <motion.div
            variants={staggerItem}
            style={{ willChange: 'transform, opacity' }}
            className="flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-black/5 pt-6 dark:border-white/10"
          >
            {trustStats.map((stat) => (
              <div key={stat.label} className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-[var(--landing-primary)] dark:text-white">
                  {stat.value}
                </span>
                <span className="text-sm text-[var(--landing-muted)]">{stat.label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25, ease: 'easeOut' }}
          className="relative"
          style={{ willChange: 'transform, opacity' }}
        >
          <motion.div
            animate={reducedMotion ? {} : { y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
            className="absolute inset-x-8 top-12 -z-10 h-72 rounded-full bg-[radial-gradient(circle,_rgba(124,58,237,0.28)_0%,_rgba(124,58,237,0)_70%)] blur-3xl"
            style={{ willChange: 'transform' }}
          />

          <div className="relative mx-auto max-w-xl">
            <Card className="overflow-hidden rounded-[2rem] border-white/35 bg-white/65 shadow-[0_32px_80px_-40px_rgba(30,27,75,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              <CardContent className="p-0">
                <div className="border-b border-black/5 px-6 py-5 dark:border-white/10">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--landing-accent)] dark:text-violet-300">
                        {t('hero.visual.label')}
                      </p>
                      <h2 className="mt-2 text-xl font-bold tracking-tight text-[var(--landing-primary)] dark:text-white">
                        {t('hero.visual.title')}
                      </h2>
                    </div>
                    <span className="relative flex items-center gap-2 rounded-full bg-[rgba(124,58,237,0.12)] px-3 py-1 text-xs font-medium text-[var(--landing-accent)] dark:bg-violet-500/20 dark:text-violet-300">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--landing-accent)] opacity-60 dark:bg-violet-300" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--landing-accent)] dark:bg-violet-300" />
                      </span>
                      {t('hero.visual.badge')}
                    </span>
                  </div>
                </div>

                <div className="space-y-4 p-6">
                  {processSteps.map((step, index) => (
                    <motion.div
                      key={step.label}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.45, delay: 0.4 + index * 0.1, ease: 'easeOut' }}
                      className="flex items-center gap-4 rounded-2xl border border-white/50 bg-white/70 px-4 py-3 shadow-[0_18px_30px_-28px_rgba(17,24,39,0.45)] dark:border-white/10 dark:bg-white/5"
                      style={{ willChange: 'transform, opacity' }}
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(30,27,75,0.08)] text-[var(--landing-primary)] dark:bg-white/10 dark:text-white">
                        <step.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[var(--landing-text)]">{step.label}</p>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[rgba(17,24,39,0.06)] dark:bg-white/10">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${68 + index * 8}%` }}
                            transition={{ duration: 0.6, delay: 0.55 + index * 0.12, ease: 'easeOut' }}
                            className="h-full rounded-full bg-gradient-to-r from-[var(--landing-primary)] to-[var(--landing-accent)]"
                            style={{ willChange: 'transform' }}
                          />
                        </div>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={reducedMotion ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, scale: 1, y: [0, -6, 0] }}
              transition={reducedMotion ? { duration: 0.5, delay: 0.9 } : { delay: 0.9, duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -left-8 -top-6 hidden items-center gap-2.5 rounded-2xl border border-white/50 bg-white/90 px-4 py-3 shadow-[0_20px_40px_-24px_rgba(30,27,75,0.5)] backdrop-blur-xl sm:flex dark:border-white/10 dark:bg-[#16141f]/90"
              style={{ willChange: 'transform, opacity' }}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                <FileBadge2 className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-[var(--landing-text)]">{t('hero.visual.floating.document')}</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={reducedMotion ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, scale: 1, y: [0, 6, 0] }}
              transition={reducedMotion ? { duration: 0.5, delay: 1.1 } : { delay: 1.1, duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -bottom-6 -right-4 hidden items-center gap-2.5 rounded-2xl border border-white/50 bg-white/90 px-4 py-3 shadow-[0_20px_40px_-24px_rgba(30,27,75,0.5)] backdrop-blur-xl sm:flex dark:border-white/10 dark:bg-[#16141f]/90"
              style={{ willChange: 'transform, opacity' }}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(124,58,237,0.15)] text-[var(--landing-accent)] dark:text-violet-300">
                <MailCheck className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-[var(--landing-text)]">{t('hero.visual.floating.client')}</span>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function SocialProofBar({ t }: { t: Translator }) {
  const pills = [t('socialProof.pills.one'), t('socialProof.pills.two'), t('socialProof.pills.three')];

  return (
    <section className="border-y border-black/5 bg-white/70 backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-0 lg:flex-row lg:items-center lg:justify-between">
        <motion.p {...itemMotion} className="text-sm font-medium text-[var(--landing-muted)]">
          {t('socialProof.title')}
        </motion.p>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={sectionViewport}
          className="flex flex-wrap items-center gap-4"
        >
          {legalIcons.map((Icon, index) => (
            <motion.div key={index} variants={staggerItem} whileHover={{ rotate: 5, scale: 1.1 }} transition={{ duration: 0.2 }} style={{ willChange: 'transform' }}>
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-black/5 bg-white text-[var(--landing-muted)] shadow-sm dark:border-white/10 dark:bg-white/5">
                <Icon className="h-5 w-5" />
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={sectionViewport}
          className="flex flex-wrap gap-3"
        >
          {pills.map((pill) => (
            <motion.span
              key={pill}
              variants={staggerItem}
              className="rounded-full border border-[rgba(124,58,237,0.14)] bg-[rgba(124,58,237,0.08)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--landing-primary)] dark:border-violet-400/20 dark:bg-violet-500/20 dark:text-violet-200"
            >
              {pill}
            </motion.span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function ProblemSection({ t, painPoints }: { t: Translator; painPoints: Array<{ icon: ComponentType<{ className?: string }>; title: string; description: string }>; }) {
  return (
    <section id="problem" className="px-4 py-20 sm:px-6 lg:px-8">
      <SectionHeader eyebrow={t('problem.eyebrow')} title={t('problem.title')} description={t('problem.description')} />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={sectionViewport}
        className="mx-auto mt-12 grid max-w-7xl gap-6 lg:grid-cols-3"
      >
        {painPoints.map((point) => (
          <motion.div
            key={point.title}
            variants={staggerItem}
            whileHover={{ y: -4, boxShadow: '0 28px 55px -32px rgba(30,27,75,0.28)' }}
            transition={{ duration: 0.2 }}
            style={{ willChange: 'transform, opacity' }}
          >
            <Card className="h-full rounded-3xl border-white/35 bg-white/60 backdrop-blur-xl shadow-[0_24px_60px_-40px_rgba(30,27,75,0.35)] dark:border-white/10 dark:bg-white/5">
              <CardContent className="flex h-full flex-col gap-5 p-7">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-1 rounded-full bg-[var(--landing-accent)]" />
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(124,58,237,0.08)] text-[var(--landing-accent)] dark:bg-violet-500/20 dark:text-violet-300">
                    <point.icon className="h-5 w-5" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold tracking-tight text-[var(--landing-text)]">{point.title}</h3>
                  <p className="mt-3 text-base leading-relaxed text-[var(--landing-muted)]">{point.description}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

function FeaturesSection({ t, features }: { t: Translator; features: Array<{ icon: ComponentType<{ className?: string }>; title: string; description: string }>; }) {
  return (
    <section id="features" className="bg-white/70 px-4 py-20 sm:px-6 lg:px-8 dark:bg-white/5">
      <SectionHeader eyebrow={t('features.eyebrow')} title={t('features.title')} description={t('features.description')} />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={sectionViewport}
        className="mx-auto mt-12 grid max-w-7xl gap-6 md:grid-cols-2 xl:grid-cols-3"
      >
        {features.map((feature) => (
          <motion.div
            key={feature.title}
            variants={staggerItem}
            whileHover={{ y: -4, boxShadow: '0 26px 54px -32px rgba(30,27,75,0.25)' }}
            transition={{ duration: 0.2 }}
            style={{ willChange: 'transform, opacity' }}
          >
            <Card className="h-full rounded-3xl border-white/40 bg-white/62 backdrop-blur-xl shadow-[0_24px_60px_-38px_rgba(17,24,39,0.28)] dark:border-white/10 dark:bg-white/5">
              <CardContent className="space-y-5 p-7">
                <motion.div whileHover={{ rotate: 5, scale: 1.1 }} transition={{ duration: 0.2 }} style={{ willChange: 'transform' }} className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(30,27,75,0.08)] text-[var(--landing-primary)] dark:bg-white/10 dark:text-white">
                  <feature.icon className="h-6 w-6" />
                </motion.div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-[var(--landing-text)]">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--landing-muted)]">{feature.description}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

function HowItWorksSection({ t, steps }: { t: Translator; steps: Array<{ title: string; description: string }>; }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 80%', 'end 30%'] });
  const mobileScale = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const desktopScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section id="how-it-works" className="px-4 py-20 sm:px-6 lg:px-8">
      <SectionHeader eyebrow={t('howItWorks.eyebrow')} title={t('howItWorks.title')} description={t('howItWorks.description')} />

      <div ref={ref} className="mx-auto mt-14 max-w-7xl">
        <div className="relative mx-auto max-w-3xl md:hidden">
          <div className="absolute bottom-12 left-[1.15rem] top-12 w-px bg-[rgba(30,27,75,0.12)] dark:bg-white/10" />
          <motion.div className="absolute bottom-12 left-[1.15rem] top-12 w-px origin-top bg-gradient-to-b from-[var(--landing-accent)] to-[var(--landing-highlight)]" style={{ scaleY: mobileScale, willChange: 'transform' }} />
          <div className="space-y-8">
            {steps.map((step, index) => (
              <motion.div key={step.title} {...itemMotion} className="relative pl-14">
                <div className="absolute left-0 top-0 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--landing-primary)] text-sm font-bold text-white shadow-lg">
                  {index + 1}
                </div>
                <div className="rounded-3xl border border-white/40 bg-white/70 p-6 shadow-[0_20px_45px_-34px_rgba(30,27,75,0.3)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--landing-accent)]">0{index + 1}</p>
                  <h3 className="mt-3 text-xl font-bold tracking-tight text-[var(--landing-text)]">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--landing-muted)]">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative hidden md:block">
          <div className="absolute left-[8%] right-[8%] top-10 h-px bg-[rgba(30,27,75,0.1)] dark:bg-white/10" />
          <motion.div className="absolute left-[8%] right-[8%] top-10 h-px origin-left bg-gradient-to-r from-[var(--landing-accent)] to-[var(--landing-highlight)]" style={{ scaleX: desktopScale, willChange: 'transform' }} />
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {steps.map((step, index) => (
              <motion.div key={step.title} {...itemMotion} className="relative pt-16">
                <div className="absolute left-0 top-0 flex h-20 w-20 items-center justify-center rounded-[2rem] bg-[rgba(124,58,237,0.08)] text-3xl font-bold tracking-tight text-[var(--landing-accent)] shadow-inner dark:bg-violet-500/20 dark:text-violet-300">
                  0{index + 1}
                </div>
                <Card className="h-full rounded-3xl border-white/35 bg-white/68 backdrop-blur-xl shadow-[0_22px_50px_-36px_rgba(30,27,75,0.28)] dark:border-white/10 dark:bg-white/5">
                  <CardContent className="space-y-4 p-7">
                    <h3 className="text-xl font-bold tracking-tight text-[var(--landing-text)]">{step.title}</h3>
                    <p className="text-sm leading-7 text-[var(--landing-muted)]">{step.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function BenefitsSection({ t, benefits }: { t: Translator; benefits: string[] }) {
  return (
    <section id="benefits" className="bg-white/75 px-4 py-20 sm:px-6 lg:px-8 dark:bg-white/5">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <SectionHeader eyebrow={t('benefits.eyebrow')} title={t('benefits.title')} description={t('benefits.description')} align="left" />
          <div className="mt-10 space-y-5">
            <StatCard prefix="" suffix="%" value={80} label={t('benefits.stats.time')} />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <StatCard prefix="" suffix="x" value={3} label={t('benefits.stats.capacity')} />
              <StatCard prefix="" suffix="" value={0} label={t('benefits.stats.manual')} />
            </div>
          </div>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={sectionViewport}
          className="grid gap-4"
        >
          {benefits.map((benefit) => (
            <motion.div key={benefit} variants={staggerItem} className="rounded-3xl border border-white/40 bg-white/68 px-5 py-5 shadow-[0_18px_45px_-34px_rgba(17,24,39,0.24)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(245,158,11,0.16)] text-[var(--landing-highlight)] dark:bg-amber-500/20">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <p className="text-base leading-7 text-[var(--landing-text)]">{benefit}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

type Testimonial = { quote: string; extended: string; author: string; role: string };

function TestimonialsSection({ t, testimonials }: { t: Translator; testimonials: Testimonial[] }) {
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (selected === null) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selected]);

  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <SectionHeader eyebrow={t('testimonials.eyebrow')} title={t('testimonials.title')} description={t('testimonials.description')} />

      {/* overflow-x-auto forces overflow-y to compute as `auto` too (CSS spec rule for mixed
          overflow values), which clips vertical overflow at this container's edges. The card's
          hover:-translate-y-1 pushes the top row right up against that edge with no headroom,
          clipping the top border. `pt-2` gives it room so the border stays visible on hover. */}
      <div className="mx-auto mt-12 max-w-7xl overflow-x-auto pb-4 pt-2">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={sectionViewport}
          className="grid min-w-full snap-x snap-mandatory auto-cols-[84%] grid-flow-col gap-5 md:grid-flow-row md:grid-cols-3"
        >
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.author}
              variants={staggerItem}
              className="snap-start pb-1"
              style={{ willChange: 'transform, opacity' }}
            >
              {selected === index ? (
                // Placeholder keeps the grid cell's size so siblings don't reflow while the
                // real layoutId element lives only inside the modal (see note below).
                <div className="h-full w-full rounded-[2rem]" aria-hidden />
              ) : (
                <motion.button
                  type="button"
                  layoutId={`testimonial-card-${index}`}
                  onClick={() => setSelected(index)}
                  className="block h-full w-full rounded-[2rem] text-left"
                  style={{ willChange: 'transform' }}
                >
                  <Card className="relative flex h-full flex-col overflow-hidden rounded-[2rem] border border-[rgba(30,27,75,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(248,245,255,0.86)_100%)] backdrop-blur-xl shadow-[0_22px_52px_-36px_rgba(17,24,39,0.25)] transition-transform duration-200 hover:-translate-y-1 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(124,58,237,0.08)_100%)]">
                    <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[rgba(124,58,237,0.1)] blur-2xl" />
                    <CardContent className="relative flex h-full flex-col p-7">
                      <motion.div
                        layoutId={`testimonial-quote-${index}`}
                        transition={{ layout: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } }}
                        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(124,58,237,0.1)] text-[var(--landing-accent)] dark:bg-violet-500/20 dark:text-violet-300"
                      >
                        <Quote className="h-5 w-5 fill-current" />
                      </motion.div>
                      <p className="mt-5 flex-1 text-base leading-8 text-[var(--landing-text)]">{testimonial.quote}</p>
                      <motion.div
                        layoutId={`testimonial-author-${index}`}
                        transition={{ layout: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } }}
                        className="mt-6 flex items-center gap-3 border-t border-[rgba(30,27,75,0.08)] pt-5 dark:border-white/10"
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--landing-primary)] to-[var(--landing-accent)] text-sm font-semibold text-white">
                          {getInitials(testimonial.author)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[var(--landing-primary)] dark:text-white">{testimonial.author}</p>
                          <p className="truncate text-sm text-[var(--landing-muted)]">{testimonial.role}</p>
                        </div>
                      </motion.div>
                    </CardContent>
                  </Card>
                </motion.button>
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>

      <AnimatePresence>
        {selected !== null && (
          <TestimonialModal
            key="testimonial-modal"
            t={t}
            testimonial={testimonials[selected]}
            index={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function TestimonialModal({
  t,
  testimonial,
  index,
  onClose,
}: {
  t: Translator;
  testimonial: Testimonial;
  index: number;
  onClose: () => void;
}) {
  return (
    <>
      <motion.div
        className="fixed inset-0 z-[70] bg-[rgba(10,8,20,0.55)] backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[71] flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
        <motion.div
          layoutId={`testimonial-card-${index}`}
          transition={{ layout: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg"
          style={{ willChange: 'transform' }}
        >
          <Card className="relative overflow-hidden rounded-[2rem] border border-[rgba(30,27,75,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(248,245,255,0.95)_100%)] shadow-[0_50px_100px_-40px_rgba(17,24,39,0.45)] dark:border-white/10 dark:bg-[linear-gradient(180deg,#16141f_0%,#1b1730_100%)]">
            <div className="absolute -right-14 -top-14 h-48 w-48 rounded-full bg-[rgba(124,58,237,0.14)] blur-3xl" />
            <button
              type="button"
              onClick={onClose}
              aria-label={t('testimonials.closeAria')}
              className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/5 text-[var(--landing-muted)] transition-colors hover:bg-black/10 hover:text-[var(--landing-text)] dark:bg-white/10 dark:hover:bg-white/15"
            >
              <X className="h-4 w-4" />
            </button>
            <CardContent className="relative space-y-6 p-8 sm:p-10">
              <motion.div
                layoutId={`testimonial-author-${index}`}
                transition={{ layout: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } }}
                className="flex items-center gap-4 border-b border-[rgba(30,27,75,0.08)] pb-6 dark:border-white/10"
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--landing-primary)] to-[var(--landing-accent)] text-base font-semibold text-white">
                  {getInitials(testimonial.author)}
                </span>
                <div>
                  <p className="font-semibold text-[var(--landing-primary)] dark:text-white">{testimonial.author}</p>
                  <p className="text-sm text-[var(--landing-muted)]">{testimonial.role}</p>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, delay: 0.4 }}
              >
                {testimonial.extended.split('\n\n').map((paragraph, paragraphIndex) => (
                  <p
                    key={paragraphIndex}
                    className={cn(
                      'text-lg leading-8 text-[var(--landing-text)] sm:text-xl sm:leading-9',
                      paragraphIndex > 0 && 'mt-4',
                    )}
                  >
                    {paragraphIndex === 0 && (
                      <motion.span
                        layoutId={`testimonial-quote-${index}`}
                        transition={{ layout: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } }}
                        className="mb-1 mr-3 inline-flex h-8 w-8 float-left items-center justify-center rounded-xl bg-[rgba(124,58,237,0.1)] text-[var(--landing-accent)] dark:bg-violet-500/20 dark:text-violet-300"
                      >
                        <Quote className="h-4 w-4 fill-current" />
                      </motion.span>
                    )}
                    {paragraph}
                  </p>
                ))}
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </>
  );
}

function FinalCtaSection({ t }: { t: Translator }) {
  const reducedMotion = useReducedMotion();
  return (
    <section id="pricing" className="px-4 py-20 sm:px-6 lg:px-8">
      <motion.div
        {...itemMotion}
        className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-[var(--landing-primary)] via-[#2d226e] to-[var(--landing-accent)] px-6 py-14 text-white shadow-[0_40px_90px_-45px_rgba(30,27,75,0.9)] sm:px-10 lg:px-14"
      >
        <motion.div
          animate={reducedMotion ? {} : { y: [0, -10, 0], x: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
          className="absolute left-8 top-8 h-40 w-40 rounded-full bg-[rgba(245,158,11,0.22)] blur-3xl"
          style={{ willChange: 'transform' }}
        />
        <motion.div
          animate={reducedMotion ? {} : { y: [0, 10, 0], x: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 7, ease: 'easeInOut' }}
          className="absolute bottom-0 right-0 h-52 w-52 rounded-full bg-[rgba(255,255,255,0.12)] blur-3xl"
          style={{ willChange: 'transform' }}
        />

        <div className="relative mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/80">
            {t('finalCta.badge')}
          </span>
          <h2 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">{t('finalCta.title')}</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-white/75">{t('finalCta.description')}</p>
          <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }} style={{ willChange: 'transform' }} className="mt-8 inline-flex">
            <Button asChild size="lg" className="rounded-full border-0 bg-[var(--landing-highlight)] px-8 text-[#1E1B4B] hover:bg-[#f8ab27]">
              <Link href="/auth/login">
                {t('finalCta.cta')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

function LandingFooter({ t }: { t: Translator }) {
  return (
    <footer className="border-t border-black/5 bg-white/70 px-4 py-10 sm:px-6 lg:px-8 dark:border-white/10 dark:bg-white/5">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 text-sm text-[var(--landing-muted)] md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1E1B4B] text-sm font-bold text-white">A</span>
            <div>
              <p className="text-lg font-bold tracking-tight text-[var(--landing-primary)] dark:text-white">Aurali</p>
              <p className="mt-1">{t('footer.tagline')}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:items-end">
          <div className="flex flex-wrap gap-5">
            <Link href="/privacy-policy" className="transition-colors hover:text-[var(--landing-primary)] dark:hover:text-white">{t('footer.links.privacy')}</Link>
            <Link href="/terms-of-service" className="transition-colors hover:text-[var(--landing-primary)] dark:hover:text-white">{t('footer.links.terms')}</Link>
            <a href="mailto:hola@aurali.app" className="transition-colors hover:text-[var(--landing-primary)] dark:hover:text-white">{t('footer.links.contact')}</a>
          </div>
          <p>{t('footer.copy')}</p>
        </div>
      </div>
    </footer>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  align = 'center',
}: {
  eyebrow: string;
  title: string;
  description: string;
  align?: 'center' | 'left';
}) {
  return (
    <motion.div
      {...itemMotion}
      className={cn('mx-auto max-w-3xl', align === 'center' ? 'text-center' : 'text-left')}
    >
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--landing-accent)] dark:text-violet-300">{eyebrow}</p>
      <h2 className="mt-4 text-4xl font-bold tracking-tight text-[var(--landing-text)] sm:text-5xl">{title}</h2>
      <p className="mt-5 text-lg leading-relaxed text-[var(--landing-muted)]">{description}</p>
    </motion.div>
  );
}

function StatCard({ prefix, suffix, value, label }: { prefix: string; suffix: string; value: number; label: string }) {
  return (
    <Card className="rounded-[2rem] border-white/40 bg-white/72 backdrop-blur-xl shadow-[0_24px_60px_-38px_rgba(30,27,75,0.3)] dark:border-white/10 dark:bg-white/5">
      <CardContent className="flex items-end justify-between gap-6 p-7">
        <div>
          <div className="text-4xl font-bold tracking-tight text-[var(--landing-primary)] sm:text-5xl dark:text-white">
            {prefix}
            <CountUp value={value} />
            {suffix}
          </div>
          <p className="mt-3 text-sm leading-7 text-[var(--landing-muted)]">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const motionValue = useMotionValue(0);
  const [display, setDisplay] = useState(0);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  useEffect(() => {
    if (!inView) return;

    const controls = animate(motionValue, value, {
      duration: 1.1,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });
    return () => controls.stop();
  }, [inView, motionValue, value]);

  return <span ref={ref}>{display}</span>;
}
