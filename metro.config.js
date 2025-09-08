const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure proper MIME types for web
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Add support for additional file extensions
config.resolver.assetExts.push('sql');

// Ensure proper transformer configuration
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    mangle: {
      keep_fnames: true,
    },
  },
};

// Web-specific configuration
config.server = {
  ...config.server,
  port: 8081,
};

module.exports = config;