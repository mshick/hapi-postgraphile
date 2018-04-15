const { curryN, includes, flip } = require('lodash/fp');

module.exports = curryN(2, flip(includes));
