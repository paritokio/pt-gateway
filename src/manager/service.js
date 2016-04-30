'use strict';

const Joi = require('joi');
const Hoek = require('hoek');
const logger = require('../util/logger');
const internals = {};

function ServiceManager(connector) {
  if (!connector) throw new Error('Connector missing !');
  this._connector = connector;
}
module.exports = ServiceManager;

ServiceManager.prototype.schema = internals.schema = Joi.object().keys({
  name: Joi.string().alphanum().min(3).max(30).required(),
  host: Joi.string().min(3).max(255).required(),
  port: Joi.number().integer().min(80).max(50000).required(),
  check: Joi.date()
});

ServiceManager.prototype.register = function (service, next) {
  next = next || () => {};
  service.check = new Date();
  Joi.validate(service, internals.schema, (err) => {
    if (err) return next(err);
    this.service(service.name, (err, values) => {
      if (err) return next(err);
      const serviceCloned = Object.assign({}, service);
      delete serviceCloned.check;
      values = values.map((elem) => { delete elem.check; return elem; });
      if (values.length === 0 || values.every(elem => !Hoek.deepEqual(elem, serviceCloned))) {
        logger.info(`Register service: ${service.name}`);
        this._connector.addService(service, next);
      }
      else {
        logger.info(`Service already registered: ${service.name}`);
        return next();
      }
    });
  });
};

ServiceManager.prototype.service = function (name, next) {
  logger.info(`Getting service: ${name}`);
  this._connector.getService(name, next);
};

ServiceManager.prototype.services = function (next) {
  logger.info(`Getting all services registered`);
  this._connector.getServices(next);
};

ServiceManager.prototype.remove = function (service, next) {
  logger.info(`Remove service: ${service.name}`);
  this._connector.removeService(service, next);
}
