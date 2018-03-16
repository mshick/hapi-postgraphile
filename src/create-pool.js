let pg;

try {
  require('pg-native');
  pg = require('pg').native;
} catch (e) {
  pg = require('pg');
}

const createPool = async (config, options = {}) => {
  try {
    const poolConfig = {
      ...config,
      ...options
    };

    return new pg.Pool(poolConfig);
  } catch (error) {
    throw error;
  }
};

module.exports = createPool;
