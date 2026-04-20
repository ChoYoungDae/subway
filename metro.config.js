const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Set the cache store to a local directory.
config.cacheStores = [
  new (require('metro-cache').FileStore)({
    root: path.join(projectRoot, '.metro-cache'),
  }),
];

module.exports = config;
