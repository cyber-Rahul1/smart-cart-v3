import { useQuery } from "@tanstack/react-query";
import { Redirect, Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform } from "react-native";

import { api } from "@/src/api";
import { usesNativeTabs } from "@/src/navigation";
import { Shop } from "@/src/partner";
import { useTheme } from "@/src/theme";
import { ErrorState, IconName, Ionicons, Loader } from "@/src/ui";

const TABS: { name: string; title: string; icon: IconName; active: IconName; sf: string }[] = [
  { name: "index", title: "Orders", icon: "receipt-outline", active: "receipt", sf: "list.bullet.rectangle.fill" },
  { name: "menu", title: "Menu", icon: "restaurant-outline", active: "restaurant", sf: "fork.knife" },
  { name: "shop", title: "Shop", icon: "storefront-outline", active: "storefront", sf: "storefront.fill" },
];

export default function PartnerTabs() {
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ["seller-me"], queryFn: () => api<{ shop: Shop | null }>("/seller/me") });
  if (q.isLoading) return <Loader />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  if (!q.data?.shop) return <Redirect href="/partner/onboarding" />;

  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandPrimary}>
        {TABS.map((t) => (
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
      headerShown: false, tabBarActiveTintColor: colors.brandPrimary, tabBarInactiveTintColor: colors.muted,
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, ...(Platform.OS === "web" ? { height: 64 } : {}) },
      tabBarItemStyle: { alignSelf: "center" }, tabBarLabelStyle: { fontWeight: "700", fontSize: 11 },
    }}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{
          title: t.title, tabBarButtonTestID: `partner-tab-${t.name}`,
          tabBarIcon: ({ focused, color }) => <Ionicons name={focused ? t.active : t.icon} size={24} color={color} />,
        }} />
      ))}
    </Tabs>
  );
}
