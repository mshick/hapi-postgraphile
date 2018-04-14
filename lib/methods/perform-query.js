const {withPostGraphileContext} = require('postgraphile');
const {graphql} = require('graphql');
const {defaults} = require('lodash/fp');
const pkg = require('../../package.json');

const performQuery = server => {
  const {pgPool, schema} = server.app[pkg.name];
  const {schemaOptions} = server.plugins[pkg.name].settings;

  return async (graphqlQuery, options = {}) => {
    const {query, variables, operationName} = graphqlQuery;
    options = defaults(schemaOptions, options);

    const {
      jwtToken,
      jwtSecret,
      jwtAudiences,
      jwtRole,
      jwtVerifyOptions,
      pgDefaultRole,
      pgSettings
    } = options;

    return withPostGraphileContext(
      {
        pgPool,
        jwtToken,
        jwtSecret,
        jwtAudiences,
        jwtRole,
        jwtVerifyOptions,
        pgDefaultRole,
        pgSettings
      },
      async context => {
        try {
          const result = await graphql(
            schema,
            query,
            null,
            {...context},
            variables,
            operationName
          );
          return result;
        } catch (error) {
          throw error;
        }
      }
    );
  };
};

module.exports = performQuery;
