const performQuery = require('./perform-query');
const pkg = require('../../package.json');

const shortName = pkg.name.replace('hapi-', '');

const register = server => {
  server.method(
    `${shortName}.performQuery`,
    performQuery(server)
  );
};

module.exports = {
  register
};
