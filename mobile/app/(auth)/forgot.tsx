import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { forgotPassword, resetPassword } from '../../src/api/auth';
import { ApiError } from '../../src/api/client';
import { Field, FormError, LinkButton, PrimaryButton } from '../../src/auth/ui';
import { useThemedStyles, type Theme } from '../../src/ui/theme';
import { notifySuccess, tapMedium } from '../../src/ui/haptics';

/**
 * Восстановление пароля.
 *
 * Один экран на оба шага, а не два: между «прислать код» и «ввести код»
 * человек уходит в почту и возвращается, и переход на другой экран
 * заставил бы вводить адрес заново.
 *
 * Сервер отвечает одинаково и на существующий адрес, и на неизвестный —
 * чтобы ручка не стала способом проверять, кто зарегистрирован. Экран это
 * повторяет: «если такой адрес есть, письмо отправлено», без обещаний.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);
  const params = useLocalSearchParams<{ email?: string }>();

  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const describe = (err: unknown, fallback: string): string => {
    if (!(err instanceof ApiError)) return fallback;
    if (err.isNetwork) return 'Сервер недоступен';
    if (err.status === 401) return 'Код неверный или устарел. Запросите новый.';
    return err.message;
  };

  const requestCode = useCallback(async () => {
    setError(null);
    setBusy(true);
    tapMedium();
    try {
      await forgotPassword(email.trim());
      setStep('confirm');
    } catch (err) {
      setError(describe(err, 'Не удалось отправить код'));
    } finally {
      setBusy(false);
    }
  }, [email]);

  const confirm = useCallback(async () => {
    setError(null);
    setBusy(true);
    tapMedium();
    try {
      await resetPassword(email.trim(), code.trim(), password);
      notifySuccess();
      // На вход, а не назад: старые сессии погашены сменой пароля,
      // и возвращаться некуда — нужно войти заново.
      router.replace('/(auth)/login');
    } catch (err) {
      setError(describe(err, 'Не удалось сменить пароль'));
    } finally {
      setBusy(false);
    }
  }, [email, code, password, router]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Забыли пароль</Text>
          <Text style={styles.hint}>
            {step === 'request'
              ? 'Пришлём пятизначный код на почту'
              : `Код отправлен на ${email.trim()}, если такой адрес зарегистрирован`}
          </Text>
        </View>

        <Field
          label="Почта"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@example.com"
          textContentType="emailAddress"
          editable={step === 'request'}
        />

        {step === 'confirm' ? (
          <>
            <Field
              label="Код из письма"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              placeholder="12345"
              maxLength={5}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
            />

            <Field
              label="Новый пароль"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              placeholder="не меньше 7 символов"
              textContentType="newPassword"
              onSubmitEditing={confirm}
              returnKeyType="go"
            />
          </>
        ) : null}

        <FormError message={error} />

        {step === 'request' ? (
          <PrimaryButton
            label="Прислать код"
            onPress={requestCode}
            busy={busy}
            disabled={!email.trim()}
          />
        ) : (
          <>
            <PrimaryButton
              label="Сменить пароль"
              onPress={confirm}
              busy={busy}
              disabled={code.trim().length !== 5 || password.length < 7}
            />
            <Text style={styles.notice}>
              Смена пароля завершит все сессии — на других устройствах придётся
              войти заново.
            </Text>
            <LinkButton
              label="Ввести другой адрес"
              onPress={() => {
                setStep('request');
                setCode('');
                setPassword('');
                setError(null);
              }}
            />
          </>
        )}

        <LinkButton label="Вспомнил — вернуться ко входу" onPress={() => router.back()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.bg },
    content: {
      padding: t.layout.screenPadding,
      paddingBottom: t.spacing.xxl,
      gap: t.spacing.lg,
    },
    header: { gap: t.spacing.xs },
    title: { ...t.type.title, color: t.colors.text },
    hint: { ...t.type.meta, color: t.colors.textDim },
    notice: { ...t.type.meta, color: t.colors.textFaint, textAlign: 'center' },
  });
