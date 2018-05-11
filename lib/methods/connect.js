const pRetry = require('p-retry');
const {
  createPostGraphileSchema,
  watchPostGraphileSchema
} = require('postgraphile');
const createPool = require('../utils/create-pool');
const pkg = require('../../package.json');

const connect = server => {
  const state = server.app[pkg.name];
  const { settings } = server.plugins[pkg.name];
  const { pgConfig, pgConnectionRetry, schemaName, schemaOptions } = settings;

  const attemptConnection = options => async () => {
    server.log([pkg.name, 'debug'], 'connection attempt started...');

    try {
      const pool = await createPool(pgConfig, options);

      if (schemaOptions.watchPg) {
        await watchPostGraphileSchema(
          pool,
          schemaName,
          schemaOptions,
          schema => {
            server.log([pkg.name, 'debug'], 'schema updated');
            state.schema = schema;
          }
        );
      } else {
        state.schema = await createPostGraphileSchema(
          pool,
          schemaName,
          schemaOptions
        );
      }

      state.pgPool = pool;
    } catch (error) {
      throw error;
    }
  };

  const keepAlive = options => {
    const onPoolError = async error => {
      /*
        Unclear what sort of error should trigger a reconnection.
        The object changes depending on implementation.
        Using pg:
        {
          message: terminating connection due to unexpected postmaster exit
          severity: FATAL
        }
        Using pg-native:
        {
          message: server closed the connection unexpectedly
            This probably means the server terminated abnormally
            before or while processing the request.
        }
      */

      if (pgConnectionRetry.retries) {
        server.log(
          [pkg.name, 'error'],
          'pool error encountered, attempting to reconnect...'
        );

        try {
          const result = await pRetry(
            attemptConnection(options),
            pgConnectionRetry
          );

          server.log([pkg.name, 'error'], 'successfully reconnected');

          return result;
        } catch (err) {
          // Done retrying
          server.log([pkg.name, 'error'], 'reconnection attempts failed');
          throw err;
        }
      } else {
        server.log([pkg.name, 'error'], 'unhandled pool error encountered');
        throw error;
      }
    };

    state.pgPool.once('error', onPoolError);
  };

  return async (options = {}) => {
    try {
      const result = await pRetry(
        attemptConnection(options),
        pgConnectionRetry
      );

      keepAlive(options);

      return result;
    } catch (error) {
      server.log([pkg.name, 'error'], 'failed to connect to database');
      throw error;
    }
  };
};

module.exports = connect;
