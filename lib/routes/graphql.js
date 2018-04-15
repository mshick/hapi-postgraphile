const Boom = require('boom');
const { get } = require('lodash/fp');
const has = require('../utils/fp/has');
const pkg = require('../../package.json');

const shortName = pkg.name.replace('hapi-', '');

const shouldVerify = verify => request => {
  return (
    verify === 'always' || (verify === 'present' && request.headers.origin)
  );
};

const onPreAuth = server => {
  const { settings } = server.plugins[pkg.name];
  const { verifyOrigin } = settings.authentication;
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
  const { settings } = server.plugins[pkg.name];

  const {
    getTokenOperationName,
    getTokenDataPath,
    refreshTokenOperationName,
    refreshTokenDataPath,
    refreshTokenQuery,
    refreshTokenVariables,
    clearTokenOperationName
  } = settings.authentication;

  const { name, options } = settings.cookieAuthentication;

  const postgraphile = server.methods[shortName];

  return async (request, h) => {
    // Clearing the token takes precendence, do it no matter what and return
    const { operationName } = request.payload;

    if (operationName === clearTokenOperationName) {
      h.unstate(name, options);
      return h.continue;
    }

    // If the request was authenticated, check for refresh
    if (refreshTokenQuery && request.auth.isAuthenticated) {
      let shouldRefresh = false;

      const { credentials } = request.auth;
      const staleAt = credentials.sat || 0;
      const now = Math.floor(new Date() / 1000);
      if (staleAt && now >= staleAt) {
        shouldRefresh = true;
      }

      if (shouldRefresh) {
        const refreshQuery = {
          query: refreshTokenQuery,
          variables: refreshTokenVariables || { input: {} },
          operationName: refreshTokenOperationName
        };

        try {
          const result = await postgraphile.performQuery(
            refreshQuery,
            request.pre
          );

          const token = get(refreshTokenDataPath, result);

          // State the cookie
          h.state(name, token, options);
        } catch (error) {
          server.log(
            [pkg.name, 'error'],
            `Token refresh failed with error: ${error.message}`,
            error
          );
        }
      }

      return h.continue;
    }

    // Finally, direct request handling
    const response = request.response;

    if (!response.isBoom) {
      const { operationName } = request.payload;

      if (operationName === getTokenOperationName) {
        const token = get(getTokenDataPath, response.source);
        h.state(name, token, options);
      }

      if (operationName === refreshTokenOperationName) {
        const token = get(refreshTokenDataPath, response.source);
        h.state(name, token, options);
      }
    }

    return h.continue;
  };
};

const getJwtToken = server => {
  const { settings } = server.plugins[pkg.name];
  const { cookieAuthentication, headerAuthentication } = settings;

  return async (request, h) => {
    if (request.auth && request.auth.isAuthenticated && request.auth.token) {
      // If using hapi-auth-jwt2 allow it to take over
      return request.auth.token;
    }

    if (cookieAuthentication && cookieAuthentication.name) {
      return request.state[cookieAuthentication.name];
    }

    if (headerAuthentication) {
      const { headerName, tokenType } = headerAuthentication;
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
  const { settings } = server.plugins[pkg.name];
  const postgraphile = server.methods[shortName];

  const { cacheAllowedOperations } = settings;

  let isCacheableOperation;

  if (cacheAllowedOperations && cacheAllowedOperations.length) {
    isCacheableOperation = has(cacheAllowedOperations);
  }

  return async request => {
    const { payload, pre } = request;
    const { operationName } = payload;

    let result;

    if (
      operationName &&
      isCacheableOperation &&
      isCacheableOperation(operationName)
    ) {
      if (postgraphile.performQueryWithCache) {
        // Cached queries cannot have options
        result = await postgraphile.performQueryWithCache(payload);
      }
    } else {
      result = await postgraphile.performQuery(payload, pre);
    }

    return result;
  };
};

module.exports = {
  onPreAuth,
  onPostAuth,
  onPreResponse,
  getJwtToken,
  handler
};
