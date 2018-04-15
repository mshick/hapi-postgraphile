const crypto = require('crypto');

const createHash = string => {
  return crypto
    .createHash('sha1')
    .update(string)
    .digest('base64');
};

module.exports = createHash;
