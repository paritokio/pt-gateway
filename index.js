'use strict';

const RedisConnector = require('./src/connector/redis');
const router = require('./src/router');
const ServiceManager = require('./src/manager/service');
const Joi = require('joi');
const server = new (require('hapi')).Server();
const logger = require('./src/util/logger');
const internals = {};

process.title = 'gateway';

internals.connector = new RedisConnector({
  host: process.env.CONNECTOR_HOST,
  port: process.env.CONNECTOR_PORT
});
internals.serviceMng = new ServiceManager(internals.connector);
internals.port = process.env.PORT || 3000;

internals.proxy = function () {
  server.route([
    {
      method: 'POST',
      path: '/service/{action}',
      handler: router.serviceHandler(internals.serviceMng),
      config: {
        validate: {
          payload: {
            service: internals.serviceMng.schema
          }
        }
      }
    },
    {
      method: 'GET',
      path: '/service/{action}',
      handler: router.serviceHandler(internals.serviceMng),
    },
    {
      method: ['GET', 'POST', 'PUT', 'DELETE'],
      path: '/{service}/{path*}',
      handler: router.proxyHandler(internals.serviceMng)
    }
  ]);
};

internals.init = function () {
  server.connection({ port: internals.port });
  internals.proxy();
  server.on('response', function (request) {
    logger.info(`${request.info.remoteAddress}: ${request.method.toUpperCase()} ${request.response.statusCode} ${request.url.path}`);
  });
  server.on('error', function (err) {
    logger.info(err);
  });
  server.start((err) => {
    if (err) throw err;
    logger.info('Gateway started');
  });
};

internals.serviceMng.register({ name:'toto', host:'localhost', port:3001 });

internals.init();
