// @flow

import type { Browser, Page, NavigationOptions, Viewport } from 'puppeteer';

import moniker from 'moniker';
import puppeteer from 'puppeteer';
import { randomUserAgent } from './user-agents';
import Logger from './logger';

const logger = new Logger('CONTROLLER');


export default class Controller {
  name: string = moniker.choose();
  headless: boolean;
  flags: Array<string> = [];
  chrome: Browser;
  dimensions: Viewport;
  executablePath: string;
  stats: { total: number, failed: number, active: number } = { total: 0, failed: 0, active: 0 };

  constructor({
    headless = !!process.env.HEADLESS,
    executablePath = process.env.CHROME_PATH,
    height = 1280, width = 1696,
  }: {
    headless?: boolean, executablePath?: string,
    height?: number, width?: number,
  } = {}) {
    this.headless = headless;
    this.dimensions = { height, width };
    this.executablePath = executablePath;
    this.flags = [
      // proxy ? `--proxy-server="${proxy}"` : '',
      // proxy ? '--host-resolver-rules="MAP * 0.0.0.0 , EXCLUDE 127.0.0.1"' : '', // FIXME
      `--user-agent="${randomUserAgent()}"`,
      `--window-size=${width},${height}`,
      '--disable-dev-shm-usage',
    ];
  }

  async start() {
    this.chrome = await puppeteer.launch({
      headless: this.headless,
      executablePath: this.executablePath,
      args: this.flags
    });
    logger.info('Chrome started!');
  }

  async newTab() {
    const page = await this.chrome.newPage();
    await page.setViewport(this.dimensions);
    return page;
  }

  async navigate(page: Page, url: string, options: NavigationOptions = {}) {
    const requestedAt = Date.now();
    await page.goto(url, options);
    const loadedAt = Date.now();

    return { requestedAt, loadedAt };
  }

  async evaluate(page: Page, expression: string, args: Object = {}) {
    const fn = (new Function(`return args => (${expression})({ document, window }, args);`)(): any);
    const result = await page.evaluate(fn, args);
    return result;
  }

  async run(url: string, expression: string, args: Object, timeout: number) {
    const page = await this.newTab();
    this.stats.total += 1;
    this.stats.active += 1;
    try {
      const { requestedAt, loadedAt } = await this.navigate(
        page, url, { waitUntil: 'domcontentloaded', timeout });

      const result = await this.evaluate(page, expression.toString(), args);
      const foundAt = Date.now();
      await this.closeTab(page);
      this.stats.active -= 1;
      return {
        worker: this.name,
        success: true,
        elapsed: {
          fetch: loadedAt - requestedAt,
          find: foundAt - loadedAt,
          total: foundAt - requestedAt
        },
        result
      };
    } catch (err) {
      logger.error(err);
      this.stats.failed += 1;
      this.stats.active -= 1;
      await this.closeTab(page);
      throw err;
    }
  }

  getStats() {
    return { worker: this.name, ...this.stats };
  }

  async closeTab(page: Page) {
    return page.close();
  }

  async closeAllTabs() {
    const pages = await this.chrome.pages();
    return Promise.all(pages.map(page => page.close()));
  }

  async kill() {
    await this.chrome.close();
  }
}
