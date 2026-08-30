const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Настройка release-сборки Android.
 *
 * Папка android/ пересоздаётся командой `expo prebuild`, поэтому править
 * build.gradle руками нельзя — правки затрутся. Всё, что нужно релизу,
 * дописывается этим плагином на этапе генерации.
 *
 * Делает две вещи:
 *
 * 1. **Подпись своим ключом.** По умолчанию Expo подписывает release тем же
 *    отладочным ключом, что и debug — такой APK нельзя обновлять поверх и
 *    нельзя выкладывать. Плагин подключает ключ из keystore.properties.
 *    Если файла нет (например, у другого разработчика), сборка не падает, а
 *    откатывается на отладочный ключ — так проект остаётся собираемым.
 *
 * 2. **Разделение по архитектурам (ABI splits).** Вместо одного APK со всеми
 *    четырьмя наборами нативных библиотек получаются отдельные файлы под
 *    каждую архитектуру. Каждый примерно вдвое меньше универсального.
 */
module.exports = function withAndroidRelease(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    let contents = gradleConfig.modResults.contents;

    contents = addReleaseSigningConfig(contents);
    contents = useReleaseSigningConfig(contents);
    contents = addAbiSplits(contents);

    gradleConfig.modResults.contents = contents;
    return gradleConfig;
  });
};

function addReleaseSigningConfig(contents) {
  if (contents.includes('signingConfigs.release')) return contents;

  const anchor = `    signingConfigs {
        debug {`;

  const injected = `    signingConfigs {
        // Ключ подписи и пароли лежат вне репозитория (см. .gitignore).
        // Без него release просто соберётся с отладочной подписью.
        release {
            def credentialsDir = rootProject.file('../credentials')
            def keystorePropertiesFile = new File(credentialsDir, 'keystore.properties')
            if (keystorePropertiesFile.exists()) {
                def keystoreProperties = new Properties()
                keystorePropertiesFile.withInputStream { keystoreProperties.load(it) }
                storeFile new File(credentialsDir, keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
        debug {`;

  return contents.replace(anchor, injected);
}

function useReleaseSigningConfig(contents) {
  const anchor = `            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;

  const injected = `            // Свой ключ, если он настроен; иначе отладочный, чтобы сборка
            // оставалась воспроизводимой без секретов.
            signingConfig rootProject.file('../credentials/keystore.properties').exists()
                ? signingConfigs.release
                : signingConfigs.debug`;

  return contents.replace(anchor, injected);
}

function addAbiSplits(contents) {
  if (contents.includes('splits {')) return contents;

  const anchor = `    buildTypes {`;

  const injected = `    splits {
        abi {
            // Только для release: debug собирается под одну архитектуру
            // и разделение там лишь замедлило бы сборку.
            enable gradle.startParameter.taskNames.any { it.toLowerCase().contains('release') }
            reset()
            // 32-битная armeabi-v7a — для старых телефонов, arm64-v8a — для всех
            // современных. Эмуляторные x86/x86_64 в раздаваемый APK не нужны,
            // но список переопределяется свойством — это единственный способ
            // прогнать release-сборку на эмуляторе:
            //   ./gradlew assembleRelease -Pytmusic.abiFilters=x86_64
            def abiFilters = (findProperty('ytmusic.abiFilters') ?: 'armeabi-v7a,arm64-v8a')
                .split(',')
                .collect { it.trim() }
                .findAll { it }
            include(*abiFilters.toArray(new String[0]))
            universalApk false
        }
    }

    buildTypes {`;

  return contents.replace(anchor, injected);
}
