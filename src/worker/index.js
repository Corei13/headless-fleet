#!/usr/bin/env node
// @flow

import Promise from 'bluebird';
import express from 'express';
import bodyParser from 'body-parser';
import moment from 'moment';

import Controller from './controller';
import Logger from '../logger';

const app = express();
const controller = new Controller();
const logger = new Logger('WORKER');

app.use(bodyParser.json({ limit: '200mb' }));

app.use((req, res, next) => {
  req.requestTime = moment();
  next();
});

app.post('/job', async (req, res, next) => {
  const { body: { url, expression, args, timeout } } = req;

  try {
    const page = await controller.newTab();
    try {
      const { requestedAt, loadedAt } = await controller.navigate(
        page, url, { waitUntil: 'domcontentloaded', timeout });
      const result = await controller.evaluate(page, expression.toString(), args);
      const foundAt = Date.now();
      res.status(200).send({
        elapsed: {
          fetch: loadedAt - requestedAt,
          find: foundAt - loadedAt,
          total: foundAt - requestedAt
        },
        result
      });
      next();
    } catch (err) {
      logger.error(err);
      next(err);
    }
    await controller.closeTab(page);
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

app.get('/health', (req, res, next) => {
  try {
    res.status(200).send({});
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

app.use((err, req, res, next) => {
  res.status(500).send({ error: err.message });
  logger.error(req.originalUrl, err.stack);
  next();
});

app.use(({ requestTime, method, originalUrl }) => {
  const elapsed = moment().diff(requestTime, 'ms') / 1000;
  logger.info(method, originalUrl, logger.bold(elapsed.toFixed(2)));
});


(async () => {
  while (true) {
    try {
      await controller.register();
      break;
    } catch (err) {
      logger.error('Failed to register:', err);
    }
    await Promise.delay(1000);
  }
  await controller.start();

  app.listen(3001, async () =>
    logger.info('controller listening on port 3001!'));
})();
