const isPgSettingValid = require('./is-pg-settings-valid');

const mapClaims = credentials => {
  const claims = {};

  for (const key of Object.keys(credentials)) {
    const rawValue = credentials[key];

    // Unsafe to pass raw object/array to pg.query -> set_config; instead JSONify
    const value =
      rawValue !== null && typeof rawValue === 'object'
        ? JSON.stringify(rawValue)
        : rawValue;

    if (isPgSettingValid(value)) {
      claims[`jwt.claims.${key}`] = String(value);
    }
  }
};

module.exports = mapClaims;
