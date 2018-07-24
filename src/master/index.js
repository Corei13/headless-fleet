#!/usr/bin/env node
// @flow

import express from 'express';
import bodyParser from 'body-parser';
import moment from 'moment';

import Controller from './controller';
import Logger from '../logger';

const app = express();
const controller = new Controller();
const logger = new Logger('MASTER');

app.use(bodyParser.json({ limit: '200mb' }));

app.use((req, res, next) => {
  req.requestTime = moment();
  next();
});

app.get('/ping', async (req, res, next) => {
  const { connection: { remoteAddress } } = req;
  res.status(200).send(controller.ping(remoteAddress.substr(7)));
  next();
});

app.get('/workers', async (req, res, next) => {
  res.status(200).send(controller.getWorkers());
  next();
});

app.post('/job/one', async (req, res, next) => {
  const {
    body: { url, expression, args = {}, timeout = 10 }
  } = req;

  try {
    const result = await controller.run(url, expression, args, Number(timeout) * 1000);
    res.status(200).send(result);
    next();
  } catch (err) {
    next(err);
  }
});

app.post('/job/batch', async (req, res, next) => {
  const { body } = req;

  try {
    const result = await Promise.all(
      body.map(({ url, expression, args = {}, timeout = 10 }) =>
        controller.run(url, expression, args, Number(timeout) * 1000).then(
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

app.use((err, req, res, next) => {
  res.status(500).send({ error: err.message });
  logger.error(req.originalUrl, err.stack);
  next();
});

app.use(({ requestTime, method, originalUrl }) => {
  const elapsed = moment().diff(requestTime, 'ms') / 1000;
  if (originalUrl !== '/ping' || elapsed >= 0.01) {
    logger.info(method, originalUrl, logger.bold(elapsed.toFixed(2)));
  }
});

app.listen(4001, () => {
  logger.info('controller listening on port 4001!');
});

controller.pingForever();
