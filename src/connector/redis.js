'use strict';

const redis = require('redis');
const async = require('async');
const internals = {};

function RedisConnector(options) {
  this._client = redis.createClient(options);
}
module.exports = RedisConnector;

RedisConnector.prototype.key = function (name, host, port) {
  if (!name && !host && !port) return `service:*`;
  if (name && !host && !port) return `service:${name}:*`;
  return `service:${name}:${host}:${port}`;
}

RedisConnector.prototype.addService = function (service, next) {
  service = service || {};
  next = next || () => {};
  const value = JSON.stringify(service);
  this._client.set(this.key(service.name, service.host, service.port), value, next);
}

RedisConnector.prototype.parseValue = function (value) {
  try {
    return JSON.parse(value);
  }
  catch (err) {
    console.log(err);
    return {};
  }
};

RedisConnector.prototype.getService = function (name, next) {
  next = next || () => {};
  const key = this.key(name);
  this._client.scan(0, 'match', key, (err, values) => {
    if (err) return next(err);
    values = values || [];
    if (values.length < 2) return next();
    const keys = values[1] || [];
    async.map(keys, (key, callback) => {
      this._client.get(key, (err, value) => {
        return callback(err, this.parseValue(value));
      });
    }, next);
  });
};

RedisConnector.prototype.getServices = function (next) {
  next = next || () => {};
  const key = this.key();
  this._client.scan(0, 'match', key, (err, values) => {
    if (err) return next(err);
    values = values || [];
    if (values.length < 2) return next();
    const keys = values[1] || [];
    const unique = keys.filter((item, pos, self) => self.indexOf(item) == pos);
    async.map(unique, (key, callback) => {
      const keyParts = key.split(':');
      const serviceName = keyParts[1];
      this.getService(serviceName, (err, values) => {
        return callback(err, {
          service: serviceName,
          node: values
        });
      });
    }, next);
  });
};

RedisConnector.prototype.removeService = function (service, next) {
  service = service || {};
  next = next || () => {};
  const key = this.key(service.name, service.host, service.port);
  this._client.del(key, next);
}
