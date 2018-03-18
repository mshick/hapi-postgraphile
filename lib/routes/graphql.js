const Boom = require('boom');
const {get} = require('lodash/fp');
const has = require('../utils/fp/has');
const pkg = require('../../package.json');

const shortName = pkg.name.replace('hapi-', '');

const shouldVerify = verify => request => {
  return (
    verify === 'always' ||
    (verify === 'present' && request.headers.origin)
  );
};

const onPostAuth = server => {
  const {settings} = server.plugins[pkg.name];
  const {verifyOrigin} = settings.authentication;
  const shouldVerifyOrigin = shouldVerify(verifyOrigin);

  return (request, h) => {
    if (shouldVerifyOrigin(request)) {
      if (!get('info.cors.isOriginMatch', request)) {
        throw Boom.forbidden();
      }
    }

    return h.continue;
  };
};

const onPreResponse = server => {
  const {settings} = server.plugins[pkg.name];
  const {loginOperationName, logoutOperationName, tokenDataPath} = settings.authentication;
  const {name, options} = settings.cookieAuthentication;

  return (request, h) => {
    const response = request.response;

    if (!response.isBoom) {
      const {operationName} = request.payload;

      if (operationName === loginOperationName) {
        const token = get(tokenDataPath, response.source);
        h.state(name, token, options);
      }

      if (operationName === logoutOperationName) {
        h.unstate(name, options);
      }
    }

    return h.continue;
  };
};

const getJwtToken = server => {
  const {settings} = server.plugins[pkg.name];
  const {cookieAuthentication, headerAuthentication} = settings;

  return (request, h) => {
    if (cookieAuthentication && cookieAuthentication.name) {
      const token = request.state[cookieAuthentication.name];
      if (token) {
        return token;
      }
    }

    if (headerAuthentication) {
      const {headerName, tokenType} = headerAuthentication;
      const header = request.headers[headerName.toLowerCase()];
      if (header && header.startsWith(tokenType)) {
        const tokenTypeLength = tokenType.length;
        return header.substr(tokenTypeLength).trim();
      }
    }

    return h.continue;
  };
};

const handler = server => {
  const {settings} = server.plugins[pkg.name];
  const postgraphile = server.methods[shortName];

  const {cacheAllowedOperations} = settings;

  let isAllowedOperation;

  if (cacheAllowedOperations && cacheAllowedOperations.length) {
    isAllowedOperation = has(cacheAllowedOperations);
  }

  return async request => {
    const {payload, pre} = request;
    const {operationName} = payload;

    if (operationName && isAllowedOperation && isAllowedOperation(operationName)) {
      if (postgraphile.performQueryWithCache) {
        // Cached queries cannot have options
        return postgraphile.performQueryWithCache(payload);
      }
    }

    return postgraphile.performQuery(payload, pre);
  };
};

module.exports = {
  onPostAuth,
  onPreResponse,
  getJwtToken,
  handler
};
