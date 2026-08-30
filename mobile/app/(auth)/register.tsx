import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { register, verify } from '../../src/api/auth';
import { ApiError } from '../../src/api/client';
import { startSession } from '../../src/auth/session';
import { Field, FormError, LinkButton, PrimaryButton } from '../../src/auth/ui';
import { useThemedStyles, type Theme } from '../../src/ui/theme';
import { notifySuccess, tapMedium } from '../../src/ui/haptics';

/**
 * Регистрация в два шага на одном экране.
 *
 * Разносить их по разным роутам нет смысла: код из письма проверяется вместе
 * с почтой, и при переходе её пришлось бы передавать через параметры навигации,
 * где она осела бы в истории.
 */
type Phase = 'form' | 'code';

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);

  const [phase, setPhase] = useState<Phase>('form');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const describe = (err: unknown, fallback: string): string =>
    err instanceof ApiError ? (err.isNetwork ? 'Сервер недоступен' : err.message) : fallback;

  const submitForm = useCallback(async () => {
    setError(null);
    setBusy(true);
    tapMedium();

    try {
      await register({ email: email.trim(), username: username.trim(), password });
      setPhase('code');
    } catch (err) {
      setError(describe(err, 'Не удалось отправить код'));
    } finally {
      setBusy(false);
    }
  }, [email, username, password]);

  const submitCode = useCallback(async () => {
    setError(null);
    setBusy(true);
    tapMedium();

    try {
      // Пользователь создаётся именно здесь и сразу получает пару токенов —
      // отдельный вход после регистрации не нужен.
      const tokens = await verify({ email: email.trim(), code: code.trim() });
      startSession(tokens);
      notifySuccess();
      router.replace('/(tabs)');
    } catch (err) {
      setError(describe(err, 'Код не подошёл'));
    } finally {
      setBusy(false);
    }
  }, [email, code, router]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        {phase === 'form' ? (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Регистрация</Text>
              <Text style={styles.hint}>На почту придёт код из пяти цифр</Text>
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
            />

            <Field
              label="Имя"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              placeholder="Как вас звать"
              maxLength={50}
            />

            <Field
              label="Пароль"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              placeholder="минимум 7 символов"
              textContentType="newPassword"
            />

            <FormError message={error} />

            <PrimaryButton
              label="Отправить код"
              onPress={submitForm}
              busy={busy}
              disabled={!email.trim() || username.trim().length < 2 || password.length < 7}
            />

            <LinkButton label="Уже есть аккаунт — войти" onPress={() => router.back()} />
          </>
        ) : (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Код из письма</Text>
              <Text style={styles.hint}>Отправлен на {email.trim()}</Text>
            </View>

            <Field
              label="Код"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              placeholder="12345"
              maxLength={5}
              autoFocus
              onSubmitEditing={submitCode}
              returnKeyType="go"
            />

            <FormError message={error} />

            <PrimaryButton
              label="Подтвердить"
              onPress={submitCode}
              busy={busy}
              disabled={code.trim().length !== 5}
            />

            <LinkButton
              label="Изменить данные"
              onPress={() => {
                setError(null);
                setCode('');
                setPhase('form');
              }}
            />
          </>
        )}
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
    header: { gap: t.spacing.xs, marginBottom: t.spacing.sm },
    title: { ...t.type.title, color: t.colors.text },
    hint: { ...t.type.meta, color: t.colors.textDim },
  });
