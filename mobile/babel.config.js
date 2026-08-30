module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Обязателен для Reanimated 4: выносит worklet-функции в отдельный
      // рантайм, чтобы анимации шли на UI-потоке и не спотыкались о JS.
      // Должен идти последним в списке плагинов.
      'react-native-worklets/plugin',
    ],
  };
};
