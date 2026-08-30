import { memo, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MiniPlayer } from '../../src/ui/components/MiniPlayer';
import { useTheme, useThemedStyles, type Theme } from '../../src/ui/theme';

/**
 * Нижняя навигация с приклеенным над ней мини-плеером.
 *
 * Панель рисуется своя, а не стандартная: мини-плеер должен быть частью той же
 * закреплённой конструкции, иначе он будет уезжать вместе с контентом
 * или перекрывать кнопки.
 */

const TABS = [
  { name: 'index', label: 'Главная', icon: 'home' },
  { name: 'explore', label: 'Обзор', icon: 'search' },
  { name: 'library', label: 'Медиатека', icon: 'library-music' },
  { name: 'profile', label: 'Профиль', icon: 'person' },
] as const;

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.bg },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
      ))}
    </Tabs>
  );
}

/**
 * Тип пропсов панели выводим из самого компонента Tabs, а не описываем руками:
 * сигнатура navigation.emit() завязана на карту событий навигатора, повторить
 * её вручную нельзя, а импортировать напрямую — значит лезть во внутренние
 * пути expo-router, которые меняются между версиями.
 */
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TabBar = memo(function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.dock}>
      <MiniPlayer />

      <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
        {state.routes.map((route, index) => {
          const tab = TABS.find((item) => item.name === route.name);
          if (!tab) return null;
          const focused = state.index === index;

          return (
            <Pressable
              key={route.key}
              style={styles.tab}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              android_ripple={{ color: 'rgba(128,128,128,0.16)', borderless: true, radius: 40 }}
            >
              <MaterialIcons
                name={tab.icon}
                size={22}
                color={focused ? theme.colors.text : theme.colors.textFaint}
              />
              {/* Подписи можно отключить темой — компактным раскладкам они мешают. */}
              {theme.components.tabBarLabels ? (
                <Text style={[styles.label, focused && styles.labelActive]}>{tab.label}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    dock: { backgroundColor: t.colors.bg },
    bar: {
      flexDirection: 'row',
      height: t.layout.tabBarHeight,
      backgroundColor: t.colors.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      paddingTop: t.spacing.xs,
    },
    label: { ...t.type.meta, fontSize: 10, color: t.colors.textFaint },
    labelActive: { color: t.colors.text, fontWeight: '600' },
  });
