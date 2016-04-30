'use strict';

const winston = require('winston');
const internals = {};

require('winston-mongodb');
module.exports = internals.logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({
      colorize: true
    }),
    new (winston.transports.MongoDB)({
      db: process.env.MONGO_LOGGING || 'mongodb://localhost:27017/pt-logging',
      collection: 'logs',
      storeHost: true,
      label: process.title,
      capped: true,
      tryReconnect: true
    })
  ]
});
