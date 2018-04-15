const { withPostGraphileContext } = require('postgraphile');
const { graphql } = require('graphql');
const { defaults } = require('lodash/fp');
const { queryError, contextError } = require('../utils/errors');
const pkg = require('../../package.json');

const performQuery = server => {
  const { pgPool, schema } = server.app[pkg.name];
  const { schemaOptions, errorHandling } = server.plugins[pkg.name].settings;

  return async (graphqlQuery, options = {}) => {
    const { query, variables, operationName } = graphqlQuery;
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

    try {
      const queryResult = await withPostGraphileContext(
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
          const result = await graphql(
            schema,
            query,
            null,
            { ...context },
            variables,
            operationName
          );

          if (errorHandling.throwQueryErrors && result.errors) {
            throw queryError(result);
          }

          return result;
        }
      );

      return queryResult;
    } catch (error) {
      if (error.isBoom) {
        throw error;
      }

      throw contextError(error);
    }
  };
};

module.exports = performQuery;
