const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
config.maxWorkers = 1;

module.exports = withNativeWind(config, { input: './src/global.css' });
