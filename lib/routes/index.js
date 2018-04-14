const Boom = require('boom');
const {
  onPreAuth,
  onPreResponse,
  getJwtToken,
  handler
} = require('./graphql');
const pkg = require('../../package.json');

const register = server => {
  const {settings} = server.plugins[pkg.name];
  const {route} = settings;

  if (route) {
    const routeOptions = route.options || {};

    const {cookieAuthentication, authentication} = settings;

    const ext = {};

    if (authentication.verifyOrigin !== 'never') {
      ext.onPostAuth = {
        method: onPreAuth(server)
      };
    }

    if (cookieAuthentication && cookieAuthentication.name) {
      ext.onPreResponse = {
        method: onPreResponse(server)
      };
    }

    const pre = routeOptions.pre || [];

    // Place first, in case user functions require
    pre.unshift({
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
