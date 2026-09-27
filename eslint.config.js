const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/**',
      'dist-native/**',
      '.npm-cache/**',
      '.tools/**',
      'artifacts/**',
      'kora-scaffold/**',
    ],
  },
]);
