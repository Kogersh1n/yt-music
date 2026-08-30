const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Сборка идёт только под мобильные платформы — веб-варианты модулей
// не тянем, чтобы не раздувать бандл.
config.resolver.platforms = ['android', 'ios', 'native'];

module.exports = config;
