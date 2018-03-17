const handleGraphql = require('./handle-graphql');
const pkg = require('../../package.json');

const register = server => {
  const {settings} = server.plugins[pkg.name];
  const {route} = settings;

  if (route) {
    server.route({
      method: 'POST',
      path: route.path,
      options: route.options,
      handler: handleGraphql(server)
    });
  }
};

module.exports = {
  register
};
