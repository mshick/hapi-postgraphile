const Boom = require('boom');
const {
  onPostAuth,
  onPreResponse,
  getJwtToken,
  handler
} = require('./graphql');
const pkg = require('../../package.json');

const register = server => {
  const {settings} = server.plugins[pkg.name];
  const {route} = settings;

  if (route) {
    const routeOptions = route.otions || {};

    const {cookieAuthentication, authentication} = settings;
    const {verifyOrigin} = authentication;

    const ext = {};

    if (verifyOrigin && verifyOrigin !== 'never') {
      ext.onPostAuth = {
        method: onPostAuth(server)
      };
    }

    if (cookieAuthentication) {
      ext.onPreResponse = {
        method: onPreResponse(server)
      };
    }

    const pre = routeOptions.pre || [];

    pre.push({
      assign: 'jwtToken',
      method: getJwtToken(server)
    });

    const validate = routeOptions.validate || {};

    validate.payload = async payload => {
      if (!payload || !payload.query) {
        throw Boom.badRequest();
      }
    };

    server.route({
      method: 'POST',
      path: route.path,
      options: {
        ...routeOptions,
        payload: {
          allow: [
            'application/json',
            'application/*+json'
          ]
        },
        validate,
        ext,
        pre
      },
      handler: handler(server)
    });
  }
};

module.exports = {
  register
};
