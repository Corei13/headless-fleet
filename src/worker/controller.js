// @flow

import type { Browser, Page, NavigationOptions, Viewport } from 'puppeteer';

import rp from 'request-promise';
import puppeteer from 'puppeteer';
import { randomUserAgent } from './user-agents';
import Logger from '../logger';

const logger = new Logger('CONTROLLER');

const MASTER = process.env.MASTER || 'localhost';

export default class Controller {
  // history: TODO
  headless: boolean;
  flags: Array<string> = [];
  chrome: Browser;
  dimensions: Viewport;

  constructor({
    headless = !!process.env.HEADLESS,
    height = 1280, width = 1696,
  }: {
    headless?: boolean,
    height?: number, width?: number,
  } = {}) {
    this.headless = headless;
    this.dimensions = { height, width };
    this.flags = [
      // proxy ? `--proxy-server="${proxy}"` : '',
      // proxy ? '--host-resolver-rules="MAP * 0.0.0.0 , EXCLUDE 127.0.0.1"' : '', // FIXME
      `--user-agent="${randomUserAgent()}"`,
      `--window-size=${width},${height}`,
      '--disable-gpu',
      '--enable-logging',
      '--log-level=0',
      '--v=99',
	    '--no-sandbox'
    ];
  }

  async start() {
    this.chrome = await puppeteer.launch({ headless: this.headless, args: this.flags });
    logger.info('Chrome started!');
  }

  async ping() {
    const { register } = await rp({
      uri: `http://${MASTER}:4001/ping`,
      json: true,
      timeout: 1000
    });
    if (register) {
      logger.info('Registered successfully!');
    }
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
