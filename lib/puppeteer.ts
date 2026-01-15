import puppeteer from 'puppeteer';
import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';

const isVercel = !!process.env.VERCEL;

export async function getBrowser() {
  if (isVercel) {
    return puppeteerCore.launch({
      executablePath: await chromium.executablePath(
        'https://github.com/Sparticuz/chromium/releases/download/v121.0.0/chromium-v121.0.0-pack.tar',
      ),
      args: chromium.args,
      headless: true,
    });
  }

  // LOCAL
  return puppeteer.launch({
    headless: true,
  });
}
