const hapi = require('hapi');
const plugin = require('./src');

const {POSTGRES_USER, POSTGRES_DB} = process.env;
const pgConfig = `postgresql://${POSTGRES_USER}@localhost/${POSTGRES_DB}`;

const start = async () => {
  try {
    const server = hapi.server({uri: 'http://localhost:5000', port: 5000});

    await server.register({
      plugin,
      options: {
        pgConfig,
        schemaName: 'forum_example',
        schemaOptions: {
          jwtSecret: 'keyboard_kitten',
          jwtPgTypeIdentifier: 'forum_example.jwt_token',
          pgDefaultRole: 'forum_example_anonymous'
        }
      }
    }, {routes: {prefix: '/foo'}});

    await server.start();

    console.log(server.info);

    return server;
  } catch (error) {
    console.error(error);
  }
};

start();
