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
      server.log([pkg.name, 'debug'], 'verifying origin');

      if (!get('info.cors.isOriginMatch', request)) {
        server.log(
          [pkg.name, 'error'],
          `failed origin match with origin: ${request.headers.origin}`
        );

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
    const response = request.response;

    if (response.isBoom) {
      return h.continue;
    }

    const { operationName } = request.payload;

    // Clearing the token take precedence
    if (operationName === clearTokenOperationName) {
      server.log([pkg.name, 'debug'], 'clearing token');

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
        server.log([pkg.name, 'debug'], 'refreshing token');

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

    if (operationName === getTokenOperationName) {
      server.log([pkg.name, 'debug'], 'getting token');

      const token = get(getTokenDataPath, response.source);
      h.state(name, token, options);
    }

    if (operationName === refreshTokenOperationName) {
      server.log([pkg.name, 'debug'], 'refreshing token');

      const token = get(refreshTokenDataPath, response.source);
      h.state(name, token, options);
    }

    return h.continue;
  };
};

const getJwtToken = server => {
  const { settings } = server.plugins[pkg.name];
  const { cookieAuthentication, headerAuthentication } = settings;

  return (request, h) => {
    // If using hapi-auth-jwt2 allow it to take over
    if (request.auth && request.auth.isAuthenticated && request.auth.token) {
      server.log([pkg.name, 'debug'], 'using request.auth token');

      return request.auth.token;
    }

    // If using header authentication, it is next
    if (headerAuthentication) {
      server.log([pkg.name, 'debug'], 'trying header authentication');

      const { headerName, tokenType } = headerAuthentication;
      const header = request.headers[headerName.toLowerCase()];
      if (header && header.startsWith(tokenType)) {
        server.log([pkg.name, 'debug'], 'using header token');

        const tokenTypeLength = tokenType.length;
        return header.substr(tokenTypeLength).trim();
      }
    }

    // Still nothing? Read from the cookie
    if (cookieAuthentication && cookieAuthentication.name) {
      server.log([pkg.name, 'debug'], 'trying cookie authentication');

      const cookie = request.state[cookieAuthentication.name];

      if (cookie) {
        server.log([pkg.name, 'debug'], 'using cookie token');

        return cookie;
      }
    }

    server.log([pkg.name, 'debug'], 'no token found');

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
      server.log([pkg.name, 'debug'], `cached query for ${operationName}`);

      if (postgraphile.performQueryWithCache) {
        // Cached queries cannot have options
        result = await postgraphile.performQueryWithCache(payload);
      }
    } else {
      server.log([pkg.name, 'debug'], `query for ${operationName}`);

      result = await postgraphile.performQuery(payload, pre);
    }

    server.log([pkg.name, 'debug'], `${operationName} succeeded`);

    return result;
  };
};

module.exports = {
  onPreAuth,
  onPreResponse,
  getJwtToken,
  handler
};
