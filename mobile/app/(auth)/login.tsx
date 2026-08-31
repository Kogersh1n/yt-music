import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { login } from '../../src/api/auth';
import { ApiError } from '../../src/api/client';
import { startSession } from '../../src/auth/session';
import { Field, FormError, LinkButton, PrimaryButton } from '../../src/auth/ui';
import { useThemedStyles, type Theme } from '../../src/ui/theme';
import { notifySuccess, tapMedium } from '../../src/ui/haptics';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    setError(null);
    setBusy(true);
    tapMedium();

    try {
      const tokens = await login(email.trim(), password);
      startSession(tokens);
      notifySuccess();
      // back(), а не replace(): вход открывается поверх приложения,
      // и человек должен вернуться туда, откуда пришёл.
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.isNetwork
            ? 'Сервер недоступен'
            : err.message
          : 'Не удалось войти',
      );
    } finally {
      setBusy(false);
    }
  }, [email, password, router]);

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
          <Text style={styles.title}>Вход</Text>
          <Text style={styles.hint}>Медиатека и лайки останутся на сервере</Text>
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
          label="Пароль"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          placeholder="••••••••"
          textContentType="password"
          onSubmitEditing={submit}
          returnKeyType="go"
        />

        <FormError message={error} />

        <PrimaryButton
          label="Войти"
          onPress={submit}
          busy={busy}
          disabled={!email.trim() || !password}
        />

        <LinkButton
          label="Нет аккаунта — зарегистрироваться"
          onPress={() => router.push('/(auth)/register')}
        />
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
