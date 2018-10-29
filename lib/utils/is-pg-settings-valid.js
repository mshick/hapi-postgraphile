const isPgSettingValid = pgSetting => {
  if (pgSetting === undefined || pgSetting === null) {
    return false;
  }
  const typeOfPgSetting = typeof pgSetting;
  if (
    typeOfPgSetting === 'string' ||
    typeOfPgSetting === 'number' ||
    typeOfPgSetting === 'boolean'
  ) {
    return true;
  }

  throw new Error(
    `Error converting pgSetting: ${typeof pgSetting} needs to be of type string, number or boolean.`
  );
};

module.exports = isPgSettingValid;
