const {withPostGraphileContext} = require('postgraphile');
const {graphql} = require('graphql');
const {defaults} = require('lodash/fp');
const pkg = require('../../package.json');

const performQuery = server => {
  const {pgPool, schema} = server.app[pkg.name];
  const {schemaOptions} = server.plugins[pkg.name].settings;

  return async (graphqlRequest, options = {}) => {
    const {query, variables, operationName} = graphqlRequest;
    options = defaults(schemaOptions, options);

    const {
      jwtToken,
      jwtSecret,
      jwtAudiences,
      pgDefaultRole,
      pgSettings
    } = options;

    return withPostGraphileContext(
      {
        pgPool,
        jwtToken,
        jwtSecret,
        jwtAudiences,
        pgDefaultRole,
        pgSettings
      },
      async context => {
        return graphql(
          schema,
          query,
          null,
          {...context},
          variables,
          operationName
        );
      }
    );
  };
};

module.exports = performQuery;
