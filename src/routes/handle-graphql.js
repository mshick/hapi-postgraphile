const Boom = require('boom');
const {get} = require('lodash/fp');
const has = require('../utils/fp/has');
const pkg = require('../../package.json');

const shortName = pkg.name.replace('hapi-', '');

const graphqlQuery = server => {
  const {settings} = server.plugins[pkg.name];
  const {jwtAuthenticate, cacheAllowedOperations} = settings;
  const postgraphile = server.methods[shortName];

  const allowedOperation = has(cacheAllowedOperations);

  return async (request, h) => {
    const {payload, headers} = request;

    if (!payload.query) {
      throw Boom.badRequest();
    }

    const options = {};

    if (jwtAuthenticate) {
      if (jwtAuthenticate.cookieName) {
        const jwtToken = request.state[jwtAuthenticate.cookieName];
        if (jwtToken) {
          options.jwtToken = jwtToken;
        }
      }

      if (!options.jwtToken && jwtAuthenticate.headerName) {
        const header = headers[jwtAuthenticate.headerName];
        if (header && header.startsWith(jwtAuthenticate.tokenType)) {
          const tokenTypeLength = jwtAuthenticate.tokenType.length;
          options.jwtToken = headers.authorization.substr(tokenTypeLength).trim();
        }
      }
    }

    const {operationName} = payload;

    let result;

    if (operationName && allowedOperation(operationName)) {
      if (postgraphile.performQueryWithCache) {
        // Cached queries cannot have options
        result = await postgraphile.performQueryWithCache(payload);
      }
    } else {
      result = await postgraphile.performQuery(payload, options);
    }

    if (jwtAuthenticate) {
      const {returnPath, cookieName, cookieOptions} = jwtAuthenticate;

      if (jwtAuthenticate.cookieName && operationName === jwtAuthenticate.operationName) {
        const token = get(returnPath, result);
        h.state(cookieName, token, cookieOptions);
      }

      if (jwtAuthenticate.cookieName && operationName === jwtAuthenticate.logoutOperationName) {
        h.unstate(cookieName, cookieOptions);
      }
    }

    return result;
  };
};

module.exports = graphqlQuery;
