import { Redirect } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import React, { useEffect, useState } from "react";
import {
  BackHandler,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { ROLE_HOME, usesNativeTabs } from "@/src/navigation";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { Ionicons, IconName } from "@/src/ui";
import { TabBarVisibilityProvider, useTabBarVisibility } from "@/src/context/tab-bar-visibility";
import { useCartSummary } from "@/src/cart";

import HomeScreen from "./index";
import ListingFood from "../listing/[type]";
import GroceriesScreen from "../groceries";

const TABS: { name: string; title: string; icon: IconName; active: IconName; sf: string }[] = [
  { name: "index", title: "Home", icon: "home", active: "home", sf: "house.fill" },
  { name: "food", title: "Food", icon: "restaurant-outline", active: "restaurant", sf: "fork.knife" },
  { name: "groceries", title: "Groceries", icon: "bag-handle-outline", active: "bag-handle", sf: "bag.fill" },
];

function TabsContent() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { totalCount: cartCount } = useCartSummary();
  const {
    tabBarTranslateY,
    activeTabIndex,
    setActiveTabIndex,
    isPagerScrollEnabled,
    isBottomNavHidden,
    setIsBottomNavHidden,
  } = useTabBarVisibility();

  const [pageWidth, setPageWidth] = useState(Dimensions.get("window").width);

  // Bubble sliding animation physics
  const bubblePosition = useSharedValue(activeTabIndex);
  const bubbleScaleX = useSharedValue(1);
  const bubbleScaleY = useSharedValue(1);

  useEffect(() => {
    // Physical squash & stretch jelly effect while traveling
    bubbleScaleX.value = withSequence(
      withTiming(1.22, { duration: 110 }),
      withSpring(1, { damping: 14, stiffness: 220, mass: 0.8 })
    );
    bubbleScaleY.value = withSequence(
      withTiming(0.85, { duration: 110 }),
      withSpring(1, { damping: 14, stiffness: 220, mass: 0.8 })
    );
    bubblePosition.value = withSpring(activeTabIndex, {
      damping: 17,
      stiffness: 190,
      mass: 0.8,
    });
  }, [activeTabIndex]);

  // When switching tabs, ensure tab bar is visible by default
  useEffect(() => {
    tabBarTranslateY.value = withTiming(0, { duration: 200 });
    setIsBottomNavHidden(false);
  }, [activeTabIndex]);

  // Handle hardware / mobile back button on Android: if on Food or Groceries, navigate back to Home (tab 0)
  useEffect(() => {
    const onBackPress = () => {
      if (activeTabIndex !== 0) {
        setActiveTabIndex(0);
        return true; // Prevent default closing of the app
      }
      return false; // On Home page, let default back button behavior occur
    };

    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, [activeTabIndex, setActiveTabIndex]);

  const tabWidth = pageWidth / TABS.length;

  const animBubbleStyle = useAnimatedStyle(() => {
    const bubbleW = 56;
    // Calculate centered translateX for current animated bubble position specifically over the icon
    const translateX = bubblePosition.value * tabWidth + (tabWidth - bubbleW) / 2;
    return {
      transform: [
        { translateX },
        { scaleX: bubbleScaleX.value },
        { scaleY: bubbleScaleY.value },
      ],
    };
  });

  const animTabBarStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: tabBarTranslateY.value }],
  }));

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
    <View
      style={{ flex: 1, backgroundColor: colors.surface }}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && w !== pageWidth) setPageWidth(w);
      }}
    >
      {/* Instant Tab Switching Container: persistent views with zero layout thrashing */}
      <View
        style={[
          StyleSheet.absoluteFill,
          activeTabIndex === 0
            ? { opacity: 1, zIndex: 1 }
            : { opacity: 0, zIndex: 0, pointerEvents: "none" as const },
        ]}
      >
        <HomeScreen />
      </View>

      <View
        style={[
          StyleSheet.absoluteFill,
          activeTabIndex === 1
            ? { opacity: 1, zIndex: 1 }
            : { opacity: 0, zIndex: 0, pointerEvents: "none" as const },
        ]}
      >
        <ListingFood forcedType="food" />
      </View>

      <View
        style={[
          StyleSheet.absoluteFill,
          activeTabIndex === 2
            ? { opacity: 1, zIndex: 1 }
            : { opacity: 0, zIndex: 0, pointerEvents: "none" as const },
        ]}
      >
        <GroceriesScreen />
      </View>

      {/* Synchronized Custom Bottom Tab Bar with High-Opacity Frost Glass */}
      {!isBottomNavHidden && (
        <Animated.View
          style={[
            {
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 9999,
              elevation: 9999,
              borderTopLeftRadius: 36,
              borderTopRightRadius: 36,
              overflow: "hidden",
              flexDirection: "row",
              alignItems: "center",
              paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.xs,
              height: insets.bottom > 0 ? insets.bottom + 46 : 56,
              shadowColor: "#F43F5E",
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.08,
              shadowRadius: 14,
            },
            animTabBarStyle,
          ]}
        >
          {/* High-Opacity Frosted Glass Base - Opaque enough to completely mask scrolling cards */}
          <BlurView
            intensity={65}
            tint="light"
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={["rgba(255, 255, 255, 0.96)", "rgba(255, 244, 247, 0.92)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Animated Sliding Bubble Behind Active Icon Only */}
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                top: 4,
                width: 56,
                height: 30,
                borderRadius: 15,
                overflow: "hidden",
                backgroundColor: "rgba(244, 63, 94, 0.12)",
                borderWidth: 1,
                borderColor: "rgba(244, 63, 94, 0.22)",
              },
              animBubbleStyle,
            ]}
          />

          {TABS.map((t, idx) => {
            const focused = activeTabIndex === idx;
            const color = focused ? "#F43F5E" : "#64748B";
            return (
              <Pressable
                key={t.name}
                testID={`tab-${t.name}`}
                onPress={() => {
                  setActiveTabIndex(idx);
                }}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 2,
                  gap: 2,
                  position: "relative",
                }}
              >
                <View style={{ width: 56, height: 30, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons
                    name={focused ? t.active : t.icon}
                    size={21}
                    color={color}
                  />
                </View>
                <Text
                  style={{
                    color,
                    fontWeight: focused ? "800" : "600",
                    fontSize: 10,
                    letterSpacing: -0.1,
                  }}
                >
                  {t.title}
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>
      )}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <TabBarVisibilityProvider>
      <TabsContent />
    </TabBarVisibilityProvider>
  );
}
