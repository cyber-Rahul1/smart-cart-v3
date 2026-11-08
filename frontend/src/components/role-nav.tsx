import { Redirect, Stack, Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform } from "react-native";

import { useAuth } from "@/src/auth";
import { usesNativeTabs } from "@/src/navigation";
import { colors, useTheme } from "@/src/theme";
import { IconName, Ionicons, Loader } from "@/src/ui";

export type TabDef = { name: string; title: string; icon: IconName; active: IconName; sf: string };

/** Stack wrapper that only lets one role in (rider/admin apps). */
export function RoleStack({ role, loginMode }: { role: string; loginMode: string }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Redirect href={`/login?mode=${loginMode}` as any} />;
  if (user.role !== role) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }} />;
}

export function RoleTabs({ tabs, testPrefix }: { tabs: TabDef[]; testPrefix: string }) {
  const { colors: c } = useTheme();
  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={c.brandPrimary}>
        {tabs.map((t) => (
          <NativeTabs.Trigger key={t.name} name={t.name}>
            <NativeTabs.Trigger.Icon sf={t.sf as any} />
            <NativeTabs.Trigger.Label>{t.title}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
    );
  }
  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: c.brandPrimary, tabBarInactiveTintColor: c.muted,
      tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border, ...(Platform.OS === "web" ? { height: 64 } : {}) },
      tabBarItemStyle: { alignSelf: "center" }, tabBarLabelStyle: { fontWeight: "700", fontSize: 11 },
    }}>
      {tabs.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{
          title: t.title, tabBarButtonTestID: `${testPrefix}-tab-${t.name}`,
          tabBarIcon: ({ focused, color }) => <Ionicons name={focused ? t.active : t.icon} size={24} color={color} />,
        }} />
      ))}
    </Tabs>
  );
}
