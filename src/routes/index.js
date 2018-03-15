const pkg = require('../../package.json');

const shortName = pkg.name.replace('hapi-', '');

const register = server => {
  const {route} = server.plugins[pkg.name].settings;
  const postgraphile = server.methods[shortName];

  if (route) {
    server.route({
      method: 'POST',
      path: route.path,
      options: route.options,
      async handler(request) {
        const {payload, headers} = request;

        if (!payload.query) {
          throw new Error('query is required');
        }

        const options = {};

        if (headers.authorization && headers.authorization.startsWith('Bearer ')) {
          options.jwtToken = headers.authorization.substr(7);
        }

        return postgraphile.performQuery(payload, options);
      }
    });
  }
};

module.exports = {
  register
};
