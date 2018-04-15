/*
  A full implementation of hapi-postgraphile working in conjunction with
  other hapi plugins and features.

  Use with the sql in this folder on top of the postgraphile reference for a
  server that provides:

  - db change events
  - auth via secure JWT cookies
  - automatic JWT refresh
  - errors that have been conformed per the JSON-API spec
*/

const hapi = require('hapi');
const { Client } = require('pg');
const qs = require('qs');

const { DATABASE_URL } = process.env;

const jwtSecret = 'keyboard_kitten';

const validate = async decoded => {
  if (decoded) {
    return { isValid: true };
  }
};

const server = hapi.server({
  port: 3001,
  host: 'localhost'
});

const start = async () => {
  const options = {
    ops: {
      interval: 1000
    },
    reporters: {
      myConsoleReporter: [
        {
          module: 'good-squeeze',
          name: 'Squeeze',
          args: [{ log: '*', response: '*' }]
        },
        {
          module: 'good-console'
        },
        'stdout'
      ]
    }
  };

  await server.register({
    plugin: require('good'),
    options
  });

  await server.register(require('hapi-auth-jwt2'));

  server.auth.strategy('jwt', 'jwt', {
    key: jwtSecret,
    validate,
    tokenType: 'Bearer',
    cookieKey: 'token',
    verifyOptions: {
      audience: 'postgraphile' // same as postgraphile
    }
  });

  server.auth.default('jwt');

  await server.register({
    plugin: require('hapi-postgraphile'),
    options: {
      route: {
        options: {
          auth: {
            mode: 'optional'
          }
        }
      },
      authentication: {
        refreshTokenQuery:
          'mutation refreshToken($input: RefreshTokenInput!){\n  refreshToken(input:$input) {\n\t\tjwtToken\n  }\n}',
        refreshTokenDataPath: 'data.refreshToken.jwtToken'
      },
      cookieAuthentication: {
        name: 'token',
        options: {
          clearInvalid: true,
          isSecure: false
        }
      },
      pgConfig: DATABASE_URL,
      schemaName: 'forum_example',
      schemaOptions: {
        jwtAudiences: ['postgraphile'],
        jwtSecret: 'keyboard_kitten',
        jwtPgTypeIdentifier: 'forum_example.jwt_token',
        pgDefaultRole: 'forum_example_anonymous'
      }
    }
  });

  await server.start();

  const client = new Client({
    connectionString: DATABASE_URL
  });

  client.on('notification', ({ payload }) => {
    const parsed = qs.parse(payload);
    console.log(parsed);
  });

  // JSON-API formatted errors
  server.ext('onPreResponse', (request, h) => {
    const response = request.response;

    if (!response.isBoom) {
      return h.continue;
    }

    let output;

    if (response.message === 'query error') {
      output = response.data;
    } else {
      const error = {
        title: response.output.payload.error,
        status: `${response.output.statusCode}`,
        detail: response.output.payload.message
      };

      output = { errors: [error] };
    }

    return h
      .response(output)
      .code(response.output.statusCode)
      .spaces(4);
  });

  await client.connect();

  await client.query(`LISTEN watchers`);

  server.log([], `Server running at: ${server.info.uri}`);
};

process.on('unhandledRejection', err => {
  console.log(err);
  process.exit(1);
});

start();
