const Boom = require('boom');

exports.validationError = err => {
  const { message, ...data } = err;

  const error = Boom.badData(message || 'validation error', data);

  error.reformat();

  error.output.payload.validation = data;

  return error;
};

exports.contextError = err => {
  const { message, statusCode, ...data } = err;

  const error = new Boom(message, { statusCode, data });

  error.reformat();

  error.output.payload = {
    ...error.output.payload,
    ...data
  };

  return error;
};

exports.queryError = data => {
  const error = Boom.badRequest('query error', data);

  error.reformat();

  error.output.payload = {
    ...error.output.payload,
    ...data
  };

  return error;
};
