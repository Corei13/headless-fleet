#!/usr/bin/env node
// @flow

import express from 'express';
import bodyParser from 'body-parser';
import moment from 'moment';

import rp from 'request-promise';
import Controller from './controller';
import Logger from './logger';

const app = express();
const controller = new Controller();
const logger = new Logger('WORKER');

const MASTER = process.env.NODE_ENV === 'production'
  ? 'headless-master' : 'localhost';

app.use(bodyParser.json({ limit: '200mb' }));

app.use((req, res, next) => {
  req.requestTime = moment();
  next();
});

app.post('/job/one', async (req, res, next) => {
  const { body: { scope, url, expression, args = {}, timeout = 15 } } = req;

  try {
    const response = scope === 'page'
      ? await controller.runOnPage(expression, args, Number(timeout) * 1000)
      : await controller.runOnConsole(url, expression, args, Number(timeout) * 1000)
    res.status(200).send(response);
    next();
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

app.post('/job/batch', async (req, res, next) => {
  const { body } = req;

  try {
    const result = await Promise.all(
      body.map(({ scope, url, expression, args = {}, timeout = 15 }) => rp({
          uri: `http://${MASTER}:3001/job/one`,
          json: true,
          method: 'POST',
          body: { scope, url, expression, args, timeout }
        }).then(
          result => ({ success: true, result }),
          err => ({ success: false, error: err.message })
        )
      )
    )
    res.status(200).send(result);
    next();
  } catch (err) {
    next(err);
  }
});

app.get('/stats', (req, res, next) => {
  try {
    res.status(200).send(controller.getStats());
    next();
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


controller.start().then(() =>
  app.listen(3001, () => {
    logger.info('controller listening on port 3001!');
  })
);
