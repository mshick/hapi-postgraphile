const Boom = require('boom');
const { withPostGraphileContext } = require('postgraphile');
const { graphql } = require('graphql');
const { defaults } = require('lodash/fp');
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
        const result = await graphql(
          schema,
          query,
          null,
          { ...context },
          variables,
          operationName
        );

        if (errorHandling.throwMethodErrors && result.errors) {
          throw Boom.badRequest('query has errors', result);
        }

        return result;
      }
    );
  };
};

module.exports = performQuery;
