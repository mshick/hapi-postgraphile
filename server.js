const hapi = require('hapi');
const plugin = require('./lib');

const {POSTGRES_USER, POSTGRES_DB} = process.env;
const pgConfig = `postgresql://${POSTGRES_USER}@localhost/${POSTGRES_DB}`;

const start = async () => {
  try {
    const server = hapi.server({uri: 'http://localhost:5000', port: 5000});

    await server.register({
      plugin,
      options: {
        pgConfig,
        pgOptions: {
          native: true
        },
        cacheAllowedOperations: [
          'getCurrentPerson'
        ],
        cacheConfig: {
          expiresIn: 1 * 60 * 60 * 1000
        },
        schemaName: 'forum_example',
        schemaOptions: {
          jwtSecret: 'keyboard_kitten',
          jwtPgTypeIdentifier: 'forum_example.jwt_token',
          pgDefaultRole: 'forum_example_anonymous'
        }
      }
    });

    await server.start();

    console.log(server.info);

    return server;
  } catch (error) {
    console.error(error);
  }
};

start();
