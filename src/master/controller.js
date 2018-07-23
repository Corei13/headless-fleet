// @flow

import Promise from 'bluebird';
import rp from 'request-promise';

import Logger from '../logger';

const logger = new Logger('CONTROLLER');

export default class Controller {
  workers: Array<string> = [];

  register(host: string) {
    this.workers.push(host);
    logger.success('Registered', host);
  }

  async pingForever() {
    while (true) {
      const res = await Promise.all(this.workers.map(host =>
        rp({
          uri: `http://${host}:3001/health`,
          timeout: 1000
        })
        .then(() => [host, true], err => {
          logger.error(err);
          return [host, false];
        })
      ));
      this.workers = [];
      res.forEach(([host, alive]) => alive
        ? this.workers.push(host)
        : logger.warn('Deregistered', host)
      )
      await Promise.delay(200);
    }
  }

  async run(url: string, expression: string, args: Object, timeout: number) {
    if (!this.workers.length) {
      throw new Error('No available worker!');
    }

    const host = this.workers.pop();
    this.workers = [host, ...this.workers];
    return rp({
      uri: `http://${host}:3001/job`,
      json: true,
      method: 'POST',
      body: { url, expression, args, timeout }
    });
  }
}
