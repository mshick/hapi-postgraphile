const qs = require('qs');
const createHash = require('../utils/create-hash');
const performQuery = require('./perform-query');
const pkg = require('../../package.json');

const shortName = pkg.name.replace('hapi-', '');

const register = server => {
  const { settings } = server.plugins[pkg.name];
  const { cacheConfig } = settings;

  server.method(`${shortName}.performQuery`, performQuery(server));

  if (cacheConfig) {
    server.method(`${shortName}.performQueryWithCache`, performQuery(server), {
      cache: cacheConfig,
      generateKey: ({ operationName, variables }) =>
        createHash(`${operationName}:${qs.stringify(variables)}`)
    });
  }
};

module.exports = {
  register
};
