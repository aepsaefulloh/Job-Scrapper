import { firefox, type Browser, type Page } from 'playwright-core';
import type { BrowserService, BrowserSession, BrowserSessionOptions } from './browser.interface.js';

export class CamoufoxBrowserService implements BrowserService {
  public constructor(private readonly executablePath: string) {}
  public async createSession(options: BrowserSessionOptions = {}): Promise<BrowserSession> {
    const browser = await firefox.launch({ executablePath: this.executablePath, headless: options.headless ?? true });
    const page = await browser.newPage(); if (options.timeoutMs) page.setDefaultTimeout(options.timeoutMs);
    return new PlaywrightSession(browser, page);
  }
}
class PlaywrightSession implements BrowserSession {
  public constructor(private readonly browser: Browser, private readonly page: Page) {}
  public async goto(url: string): Promise<void> { await this.page.goto(url, { waitUntil: 'domcontentloaded' }); }
  public async getContent(): Promise<string> { return this.page.content(); }
  public async close(): Promise<void> { await this.browser.close(); }
}
