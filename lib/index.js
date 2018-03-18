const Ajv = require('ajv');
const {createPostGraphileSchema} = require('postgraphile');
const {cloneDeep, isString} = require('lodash/fp');
const settingsSchema = require('./schemas/settings.json');
const urlToConfig = require('./utils/url-to-config');
const createPool = require('./create-pool');
const methods = require('./methods');
const routes = require('./routes');
const pkg = require('../package.json');

const ajv = new Ajv({useDefaults: true});

const register = async (server, options = {}) => {
  const settings = cloneDeep(options);

  if (isString(settings.pgConfig)) {
    settings.pgConfig = urlToConfig(settings.pgConfig);
  }

  const isValid = ajv.validate(settingsSchema, settings);

  if (!isValid) {
    server.log([pkg.name, 'error'], ajv.errors);
    throw new Error('Invalid configuration options.');
  }

  if (settings.cookieAuthentication && settings.authentication.verifyOrigin === 'never') {
    server.log([pkg.name, 'warn'], 'Cookie authentication enabled but verifyOrigin is set to never. This is unsafe and can allow CSRF attacks.');

    if (!settings.authentication.verifyOriginOverride) {
      server.log([pkg.name, 'info'], 'Setting verifyOrigin to the "present" setting. Use verifyOriginOverride if you really want to keep it at "never".');
      settings.authentication.verifyOrigin = 'present';
    }
  }

  server.expose('settings', settings);

  const state = {};

  server.app[pkg.name] = state;

  const {pgConfig, pgOptions, schemaName, schemaOptions} = settings;

  state.pgPool = await createPool(pgConfig, pgOptions);
  state.schema = await createPostGraphileSchema(state.pgPool, schemaName, schemaOptions);

  const {password: _, ...connectionToLog} = pgConfig;

  server.log([pkg.name, 'info'], 'Postgres connection created for ' + JSON.stringify(connectionToLog));

  methods.register(server);

  routes.register(server);

  const closePool = async () => {
    try {
      await state.pgPool.end();
    } catch (error) {
      server.log([pkg.name, 'error'], error);
    }
  };

  server.events.on('stop', closePool);
};

exports.plugin = {
  register,
  pkg
};
