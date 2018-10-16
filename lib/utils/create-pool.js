const pgConectionString = require('pg-connection-string');

let pg;

try {
  require('pg-native');
  pg = require('pg').native;
} catch (e) {
  pg = require('pg');
}

const createPool = (config, options = {}) => {
  try {
    let poolConfig = config;

    if (config.connectionString) {
      poolConfig = pgConectionString.parse(config.connectionString);
    }

    poolConfig = { ...poolConfig, ...options };

    return new pg.Pool(poolConfig);
  } catch (error) {
    throw error;
  }
};

module.exports = createPool;
