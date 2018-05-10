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

  const connectToPool = async options => {
    const pool = await createPool(pgConfig, options);

    if (schemaOptions.watchPg) {
      await watchPostGraphileSchema(pool, schemaName, schemaOptions, schema => {
        server.log([pkg.name, 'debug'], 'schema updated');
        state.schema = schema;
      });
    } else {
      state.schema = await createPostGraphileSchema(
        pool,
        schemaName,
        schemaOptions
      );
    }

    state.pgPool = pool;
  };

  const attemptConnection = options => async () => {
    server.log([pkg.name, 'error'], 'reconnection attempt started...');

    try {
      await connectToPool(options);
      server.log([pkg.name, 'error'], 'successfully reconnected');
    } catch (error) {
      throw error;
    }
  };

  const keepAlive = options => {
    const onPoolError = async () => {
      server.log([pkg.name, 'error'], 'pool error encountered');

      if (state.pgPool) {
        // Clear out the pool, it's no longer good
        state.pgPool.removeListener('error', onPoolError);
        state.pgPool = null;
      }

      const attemptOperation = attemptConnection(options);

      try {
        const result = await pRetry(attemptOperation, pgConnectionRetry);
        return result;
      } catch (error) {
        // Done retrying, throw the final error
        server.log([pkg.name, 'error'], 'reconnection attempts failed');
      }
    };

    state.pgPool.on('error', onPoolError);
  };

  return async (options = {}) => {
    try {
      const attemptOperation = attemptConnection(options);

      const result = await pRetry(attemptOperation, pgConnectionRetry);

      keepAlive(options);

      const { password: _, ...connectionToLog } = pgConfig;

      server.log(
        [pkg.name, 'info'],
        'Postgres connection created for ' + JSON.stringify(connectionToLog)
      );

      return result;
    } catch (error) {
      server.log([pkg.name, 'error'], 'failted to connect to database');
      throw error;
    }
  };
};

module.exports = connect;
