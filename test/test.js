import test from 'ava';
import hapi from 'hapi';
import plugin from '../lib';

const { POSTGRES_USER, POSTGRES_DB } = process.env;
const pgConfig = `postgresql://${POSTGRES_USER}@localhost/${POSTGRES_DB}`;

test('simple test', async t => {
  try {
    const server = hapi.server({ port: 5000 });

    await server.register({
      plugin,
      options: {
        pgConfig,
        schemaOptions: {
          jwtSecret: 'keyboard_kitten'
        }
      }
    });

    await server.start();

    t.pass();
  } catch (err) {
    t.fail(err);
  }
});
