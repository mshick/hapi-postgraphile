const Boom = require('boom');

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
