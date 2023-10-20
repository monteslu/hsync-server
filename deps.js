const Joi = require('joi');
const Boom = require('@hapi/boom');
const b64Id = require('b64id');
const aedes = require('./aedes');

module.exports = {
  Joi,
  Boom,
  b64Id,
  aedes,
};
