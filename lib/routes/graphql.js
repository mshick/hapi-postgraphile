const {promisify} = require('util');
const Boom = require('boom');
const jwt = require('jsonwebtoken');
const jwtVerify = promisify(jwt.verify);
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
  const {cookieAuthentication, headerAuthentication, schemaOptions} = settings;
  const {jwtSecret} = schemaOptions;

  return async (request, h) => {
    let token;

    if (request.auth && request.auth.token) {
      // If using hapi-auth-jwt2 allow it to take over
      return request.auth.token;
    }

    if (cookieAuthentication && cookieAuthentication.name) {
      token = request.state[cookieAuthentication.name];
    }

    if (headerAuthentication) {
      const {headerName, tokenType} = headerAuthentication;
      const header = request.headers[headerName.toLowerCase()];
      if (header && header.startsWith(tokenType)) {
        const tokenTypeLength = tokenType.length;
        token = header.substr(tokenTypeLength).trim();
      }
    }

    if (token) {
      try {
        await jwtVerify(token, jwtSecret);
        return token;
      } catch (error) {
        throw Boom.badRequest(error);
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
