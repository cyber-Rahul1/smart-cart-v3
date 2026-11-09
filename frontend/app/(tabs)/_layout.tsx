import { Redirect, Tabs, useRouter, useSegments } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import React, { useRef } from "react";
import { Platform, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { useAuth } from "@/src/auth";
import { ROLE_HOME, usesNativeTabs } from "@/src/navigation";
import { useTheme } from "@/src/theme";
import { Ionicons, IconName } from "@/src/ui";

const TABS: { name: string; title: string; icon: IconName; active: IconName; sf: string }[] = [
  { name: "index", title: "Home", icon: "home-outline", active: "home", sf: "house.fill" },
  { name: "reels", title: "Trending", icon: "play-circle-outline", active: "play-circle", sf: "play.rectangle.fill" },
  { name: "cart", title: "Cart", icon: "bag-handle-outline", active: "bag-handle", sf: "bag.fill" },
  { name: "account", title: "Account", icon: "person-circle-outline", active: "person-circle", sf: "person.crop.circle.fill" },
];

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const segments = useSegments();

  // Find currently active tab index from segments
  const activeTabName = (segments[1] as string) || "index";
  const currentIndex = TABS.findIndex((t) => t.name === activeTabName);
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex >= 0 ? currentIndex : 0;

  // Track swipe navigation to avoid multiple rapid navigations in a single gesture
  const isNavigatingRef = useRef(false);

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-25, 25])
    .failOffsetY([-20, 20])
    .onBegin(() => {
      isNavigatingRef.current = false;
    })
    .onUpdate((e) => {
      if (isNavigatingRef.current) return;

      const curIdx = currentIndexRef.current;
      const SWIPE_THRESHOLD = 50;

      // Swiping Right to Left -> Go to next tab
      if (e.translationX < -SWIPE_THRESHOLD && e.velocityX < -200) {
        if (curIdx < TABS.length - 1) {
          isNavigatingRef.current = true;
          const nextTab = TABS[curIdx + 1];
          router.navigate(nextTab.name === "index" ? "/(tabs)" : (`/(tabs)/${nextTab.name}` as any));
        }
      }
      // Swiping Left to Right -> Go to previous tab
      else if (e.translationX > SWIPE_THRESHOLD && e.velocityX > 200) {
        if (curIdx > 0) {
          isNavigatingRef.current = true;
          const prevTab = TABS[curIdx - 1];
          router.navigate(prevTab.name === "index" ? "/(tabs)" : (`/(tabs)/${prevTab.name}` as any));
        }
      }
    })
    .onEnd(() => {
      isNavigatingRef.current = false;
    });

  if (!loading && !user) return <Redirect href="/login" />;
  if (user && ROLE_HOME[user.role]) return <Redirect href={ROLE_HOME[user.role] as any} />;

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
    <GestureDetector gesture={panGesture}>
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            animation: "shift",
            tabBarActiveTintColor: colors.brandPrimary,
            tabBarInactiveTintColor: colors.muted,
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              ...(Platform.OS === "web" ? { height: 64 } : {}),
            },
            tabBarItemStyle: { alignSelf: "center" },
            tabBarLabelStyle: { fontWeight: "700", fontSize: 11 },
          }}
        >
          {TABS.map((t) => (
            <Tabs.Screen
              key={t.name}
              name={t.name}
              options={{
                title: t.title,
                tabBarButtonTestID: `tab-${t.name}`,
                tabBarIcon: ({ focused, color }) => (
                  <Ionicons name={focused ? t.active : t.icon} size={24} color={color} />
                ),
              }}
            />
          ))}
        </Tabs>
      </View>
    </GestureDetector>
  );
}
