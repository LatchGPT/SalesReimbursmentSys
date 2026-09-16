import pino from 'pino';
import pinoHttp from 'pino-http';
import crypto from 'crypto';
import { config } from '../config';

export const logger = pino({
  level: config.logLevel,
  transport: config.isProduction ? undefined : {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' }
  },
});

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existing = req.headers['x-request-id'];
    const id = (typeof existing === 'string' && existing) || crypto.randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  autoLogging: {
    ignore: (req) => req.url === '/healthz' || req.url === '/readyz',
  },
});
