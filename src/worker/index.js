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
    const response = await controller.run(url, expression, args, timeout);
    res.status(200).send(response);
    next();
  } catch (err) {
    logger.error(err);
    next(err);
  }
});

app.get('/health', (req, res, next) => {
  try {
    const { total, active, failed } = controller.health();
    res.status(200).send({ total, active, failed });
    logger.info('Total:', total, 'Active:', active, 'Failed:', failed);
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
