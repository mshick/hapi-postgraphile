const url = require('url');

const urlToConfig = connectionUrl => {
  const {hostname: host, port, pathname, auth} = url.parse(connectionUrl);
  const [user, password] = auth ? auth.split(':') : [];
  const [, database] = pathname ? pathname.split('/') : [];

  return {
    user,
    password,
    host,
    port,
    database
  };
};

module.exports = urlToConfig;
