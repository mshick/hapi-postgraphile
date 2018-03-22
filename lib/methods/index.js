const qs = require('qs');
const {promisify} = require('util');
const createHash = require('../utils/create-hash');
const performQuery = require('./perform-query');
const pkg = require('../../package.json');

const shortName = pkg.name.replace('hapi-', '');

const register = server => {
  const {settings} = server.plugins[pkg.name];
  const {cacheConfig} = settings;

  server.method(
    `${shortName}.performQuery`,
    performQuery(server),
  );

  if (cacheConfig) {
    server.method(
      `${shortName}.performQueryCached`,
      performQuery(server),
      {
        callback: false,
        cache: cacheConfig,
        generateKey: payload => {
          const {operationName, variables} = payload || {};
          return createHash(`${operationName}:${qs.stringify(variables)}`);
        }
      }
    );

    const performQueryCached = server.methods[shortName].performQueryCached;
    server.method(
      `${shortName}.performQueryWithCache`,
      promisify(performQueryCached)
    );
  }
};

module.exports = {
  register
};
