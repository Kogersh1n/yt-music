import { Stack } from 'expo-router';
import { useTheme } from '../../src/ui/theme';

export default function AuthLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.bg },
        animation: theme.motion.scale === 0 ? 'none' : 'fade',
      }}
    />
  );
}
