const { withGradleProperties } = require('expo/config-plugins');

const GRADLE_PROPERTIES = {
  'android.cmakeVersion': '3.31.6',
  'expo.android.cmakeObjectPathMax': '240',
};

module.exports = function withWindowsNativePaths(config) {
  return withGradleProperties(config, (config) => {
    for (const [key, value] of Object.entries(GRADLE_PROPERTIES)) {
      const property = config.modResults.find(
        (item) => item.type === 'property' && item.key === key
      );

      if (property) {
        property.value = value;
      } else {
        config.modResults.push({ type: 'property', key, value });
      }
    }

    return config;
  });
};
