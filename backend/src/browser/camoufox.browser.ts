import fs from 'node:fs';
import path from 'node:path';
import { firefox, type Browser, type BrowserContext, type Page } from 'playwright-core';
import type { BrowserService, BrowserSession, BrowserSessionOptions } from './browser.interface.js';

interface CamoufoxOptsFile {
  executable_path?: string;
  env?: Record<string, string>;
  firefox_user_prefs?: Record<string, string | number | boolean>;
}

export class CamoufoxBrowserService implements BrowserService {
  private cachedOpts?: CamoufoxOptsFile;

  public constructor(private readonly executablePath: string) {
    this.loadOpts();
  }

  private loadOpts(): void {
    const candidates = [
      path.resolve(process.cwd(), 'camoufox_opts.json'),
      path.resolve(process.cwd(), 'backend', 'camoufox_opts.json')
    ];
    for (const file of candidates) {
      if (fs.existsSync(file)) {
        try {
          this.cachedOpts = JSON.parse(fs.readFileSync(file, 'utf8'));
          break;
        } catch {
          // Ignore parse errors, fallback to default launch
        }
      }
    }
  }

  public async createSession(options: BrowserSessionOptions = {}): Promise<BrowserSession> {
    const env = this.cachedOpts?.env ? { ...process.env, ...this.cachedOpts.env } : undefined;
    const firefoxUserPrefs: Record<string, string | number | boolean> = this.cachedOpts?.firefox_user_prefs ?? {
      'webgl.enable-webgl2': true,
      'webgl.force-enabled': true
    };

    const browser = await firefox.launch({
      executablePath: this.executablePath,
      headless: options.headless ?? true,
      env,
      firefoxUserPrefs
    });

    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();
    if (options.timeoutMs) page.setDefaultTimeout(options.timeoutMs);
    return new PlaywrightSession(browser, context, page);
  }
}

class PlaywrightSession implements BrowserSession {
  public constructor(
    private readonly browser: Browser,
    private readonly context: BrowserContext,
    private readonly page: Page
  ) {}

  public async goto(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  public async getContent(): Promise<string> {
    return this.page.content();
  }

  public async close(): Promise<void> {
    await this.context.close().catch(() => {});
    await this.browser.close().catch(() => {});
  }
}

