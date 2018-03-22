import test from 'ava';
import hapi from 'hapi';
import plugin from '../lib';

const {POSTGRES_USER, POSTGRES_DB} = process.env;
const pgConfig = `postgresql://${POSTGRES_USER}@localhost/${POSTGRES_DB}`;

test('simple test', async t => {
  try {
    const server = new hapi.Server();

    server.connection({
      port: 5000
    });

    server.register({
      register: plugin,
      options: {
        pgConfig
      }
    }, () => {
      server.start(() => {
        t.pass();
      });
    });
  } catch (err) {
    t.fail(err);
  }
});
