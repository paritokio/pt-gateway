'use strict';

const Wreck = require('wreck');
const Boom = require('boom');
const url = require('url');
const logger = require('../util/logger');
const internals = {};

function Router() {}
module.exports = new Router();

internals.balancing = {};

// Just equal repartition...
internals.getServiceWithBalance = function (serviceName, values) {
  values = values || [];
  if (!this.balancing[serviceName]) this.balancing[serviceName] = 0;
  else if (this.balancing[serviceName] >= values.length) this.balancing[serviceName] = 0;
  return values[this.balancing[serviceName]];
};

Router.prototype.proxyHandler = function (serviceManager) {
  return function (request, reply) {
    const serviceName = request.params.service;
    const options = {
      method: request.method,
      headers: request.headers || [],
      payload: request.payload,
      timeout: process.env.TIMEOUT || 2000
    };
    options.headers['x-forwarded-for'] = request.info.remoteAddress;
    serviceManager.service(serviceName, (err, values) => {
      values = values || [];
      if (err) return reply(Boom.resourceGone('Service Registry down...'));
      if (values.length === 0) return reply(Boom.preconditionFailed('The service seems not there'));
      const service = internals.getServiceWithBalance(serviceName, values);
      const urlObject = {
        protocol: 'http',
        hostname: service.host,
        port: service.port,
        query: request.query || {},
        pathname: request.params.path
      };
      const uri = url.format(urlObject);
      Wreck.request(options.method, uri, options, (err, data) => {
        if (err) {
          //Try other service in the same node !!!!
          if (err.isBoom && err.output.statusCode === 504) serviceManager.remove(service);
          return reply(err);
        }
        logger.info(`Forward ${request.info.host} -> ${service.host}:${service.port}`);
        return reply(null, data);
      });
    });
  };
};

Router.prototype.serviceHandler = function (serviceManager) {
  return function (request, reply) {
    const action = request.params.action;
    const service = request.payload ? request.payload.service : {};
    if (action === 'register') {
      serviceManager.register(service, (err) => {
        if (err && err.isJoi) return reply(Boom.badData(err));
        if (err) return reply(Boom.wrap(err));
        return reply({ done: true });
      });
    }
    else if (action === 'list') {
      serviceManager.services((err, values) => {
        if (err) reply(Boom.wrap(err));
        return reply(values);
      });
    }
    else {
      return reply(Boom.badRequest('Unknown action'));
    }
  };
};
