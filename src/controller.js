// @flow

import type { Browser, Page, Viewport } from 'puppeteer';

import Promise from 'bluebird';
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

  async runOnPage(expression: string, args: Object, timeout: number) {
    this.stats.total += 1;
    this.stats.active += 1;

    const start = Date.now();
    const page = await this.newTab();

    const fn = (new Function(`return (page, args) => (${expression})(page, args);`)(): any);

    const res = await Promise.race([
      fn(page, args).then(result => ({
        worker: this.name,
        success: true,
        elapsed: {
          total: Date.now() - start
        },
        result
      })),
      Promise.delay(timeout).then(() => {
        throw new Error(`Timed out after ${timeout}ms`)
      })
    ]).catch(err => {
      logger.error(err);
      this.stats.failed += 1;
      return ({
        worker: this.name,
        success: false,
        elapsed: {
          total: Date.now() - start
        },
        error: err.message
      });
    });
    await this.closeTab(page);

    this.stats.active -= 1;

    return res;
  }

  async runOnConsole(url: string, expression: string, args: Object, timeout: number) {
    const fn = async (page, { url, expression, args, timeout }) => {
      const requestedAt = Date.now();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      const loadedAt = Date.now();

      const fn = (new Function(`return args => (${expression})({ document, window }, args);`)(): any);
      const result = await page.evaluate(fn, args);

      const foundAt = Date.now();

      return {
        elapsed: {
          fetch: loadedAt - requestedAt,
          find: foundAt - loadedAt
        },
        result
      };
    };
    const {
      result: { result, elapsed = {} } = {},
      ...rest
    } = await this.runOnPage(fn.toString(), { url, expression: expression.toString(), args, timeout }, timeout);

    return {
      ...rest,
      result,
      elapsed: { ...elapsed, ...rest.elapsed }
    };
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
