const Ajv = require('ajv');
const { cloneDeep, isString } = require('lodash/fp');
const settingsSchema = require('./schemas/settings.json');
const pgConnectionString = require('pg-connection-string');
const methods = require('./methods');
const routes = require('./routes');
const { validationError } = require('./utils/errors');
const pkg = require('../package.json');

const ajv = new Ajv({ useDefaults: true });

const after = async server => {
  server.log([pkg.name, 'debug'], 'registering routes');
  routes.register(server);
};

const register = async (server, options = {}) => {
  server.log([pkg.name, 'debug'], 'registering plugin');

  const settings = cloneDeep(options);

  if (isString(settings.pgConfig)) {
    settings.pgConfig = pgConnectionString.parse(settings.pgConfig);
  }

  const isValid = ajv.validate(settingsSchema, settings);

  if (!isValid) {
    server.log([pkg.name, 'error'], ajv.errors);
    throw validationError({
      message: 'invalid configuration options',
      errors: ajv.errors
    });
  }

  if (
    settings.cookieAuthentication &&
    settings.authentication.verifyOrigin === 'never'
  ) {
    server.log(
      [pkg.name, 'warn'],
      'Cookie authentication enabled but verifyOrigin is set to never. This is unsafe and can allow CSRF attacks.'
    );

    if (!settings.authentication.verifyOriginOverride) {
      server.log(
        [pkg.name, 'info'],
        'Setting verifyOrigin to the "present" setting. Use verifyOriginOverride if you really want to keep it at "never".'
      );
      settings.authentication.verifyOrigin = 'present';
    }
  }

  server.expose('settings', settings);

  const state = {};

  server.app[pkg.name] = state;

  server.log([pkg.name, 'debug'], 'registering methods');

  methods.register(server);

  server.log([pkg.name, 'debug'], 'creating pg connection pool');

  await server.methods.postgraphile.connect();

  const { password: _, ...connectionToLog } = settings.pgConfig;

  server.log(
    [pkg.name, 'info'],
    'Postgres connection created for ' + JSON.stringify(connectionToLog)
  );

  const closePool = async () => {
    server.log([pkg.name, 'debug'], `ending pg connection pool`);

    try {
      await state.pgPool.end();
    } catch (error) {
      server.log([pkg.name, 'error'], error);
    }
  };

  server.events.on('stop', closePool);

  if (settings.dependencies.length) {
    server.log(
      [pkg.name, 'debug'],
      `loading routes after dependencies: ${settings.dependencies.join(',')}`
    );

    server.dependency(settings.dependencies, after);
  } else {
    await after(server);
  }
};

exports.plugin = {
  register,
  multiple: true,
  pkg
};
