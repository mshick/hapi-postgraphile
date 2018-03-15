let pg;

try {
  require('pg-native');
  pg = require('pg').native;
} catch (e) {
  pg = require('pg');
}

const createPool = async config => {
  try {
    return new pg.Pool(config);
  } catch (error) {
    throw error;
  }
};

module.exports = createPool;
