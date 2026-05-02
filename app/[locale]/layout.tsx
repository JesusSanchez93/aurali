import { Geist } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import '../globals.css';
import { Suspense } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { AppLoadingFallback } from '@/components/common/app-loading-fallback';
import { SpeedInsights } from "@vercel/speed-insights/next"

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    metadataBase: new URL(defaultUrl),
    title: t('title'),
    description: t('description'),
  };
}

const geistSans = Geist({
  variable: '--font-geist-sans',
  display: 'swap',
  subsets: ['latin'],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isValidLocale = routing.locales.includes(
    locale as (typeof routing.locales)[number]
  );

  // Ensure that the incoming `locale` is valid
  if (!isValidLocale) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  // Providing all messages to the client
  // side is the easiest way to get started
  const [messages, t] = await Promise.all([
    getMessages(),
    getTranslations('common')
  ]);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${geistSans.className}`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Suspense
            fallback={
              <AppLoadingFallback
                label={t('loading')}
                description={t('loading_description')}
              />
            }
          >
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              {children}
              <SpeedInsights />
            </ThemeProvider>
            <Toaster position="top-right" richColors />
          </Suspense>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
