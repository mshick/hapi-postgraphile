const qs = require('qs');
const createHash = require('../utils/create-hash');
const connect = require('./connect');
const performQuery = require('./perform-query');
const pkg = require('../../package.json');

const shortName = pkg.name.replace('hapi-', '');

const register = server => {
  const { settings } = server.plugins[pkg.name];
  const { cacheConfig } = settings;

  server.method({
    name: `${shortName}.connect`,
    method: connect(server)
  });

  server.method({
    name: `${shortName}.performQuery`,
    method: performQuery(server)
  });

  if (cacheConfig) {
    server.method({
      name: `${shortName}.performQueryWithCache`,
      method: performQuery(server),
      options: {
        cache: cacheConfig,
        generateKey: ({ operationName, variables }) =>
          createHash(`${operationName}:${qs.stringify(variables)}`)
      }
    });
  }
};

module.exports = {
  register
};
