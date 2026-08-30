#!/usr/bin/env bash
# Запуск приложения на эмуляторе (проверка на ноуте, без телефона).
#
# Собирает release-APK под x86_64 (эмулятор — не ARM), ставит его,
# пробрасывает порты бэкенда внутрь и запускает.
set -euo pipefail

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"

AVD="${AVD:-ytmusic_test}"
APK="android/app/build/outputs/apk/release/app-x86_64-release.apk"

if ! adb devices | grep -q "emulator-.*device"; then
  echo "→ запускаю эмулятор $AVD"
  nohup emulator -avd "$AVD" -gpu swiftshader_indirect -no-boot-anim -no-snapshot \
    >/dev/null 2>&1 &
  adb wait-for-device
  until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
    sleep 2
  done
  echo "→ эмулятор загрузился"
fi

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "→ собираю APK под x86_64"
  (cd android && ./gradlew assembleRelease --console=plain \
     -Pytmusic.abiFilters=x86_64 -PreactNativeArchitectures=x86_64 -q)
fi

echo "→ ставлю APK"
adb install -r "$APK" >/dev/null

# Эмулятор не видит машину по локальной сети. Пробрасываем порты внутрь —
# тогда localhost внутри эмулятора это ваш ноут, и подпись ссылок MinIO
# не ломается (хост остаётся localhost).
adb reverse tcp:8000 tcp:8000 >/dev/null   # бэкенд
adb reverse tcp:9000 tcp:9000 >/dev/null   # MinIO: обложки и аудио

adb shell monkey -p com.duklet.ytmusic -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
echo "→ готово, приложение в окне эмулятора"
