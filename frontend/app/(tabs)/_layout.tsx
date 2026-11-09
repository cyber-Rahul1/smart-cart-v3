import { Redirect } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { ROLE_HOME, usesNativeTabs } from "@/src/navigation";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { Ionicons, IconName } from "@/src/ui";
import { TabBarVisibilityProvider, useTabBarVisibility } from "@/src/context/tab-bar-visibility";

import HomeScreen from "./index";
import Reels from "./reels";
import CartScreen from "./cart";
import Account from "./account";

const TABS: { name: string; title: string; icon: IconName; active: IconName; sf: string }[] = [
  { name: "index", title: "Home", icon: "home-outline", active: "home", sf: "house.fill" },
  { name: "reels", title: "Bites", icon: "play-circle-outline", active: "play-circle", sf: "play.rectangle.fill" },
  { name: "cart", title: "Cart", icon: "bag-handle-outline", active: "bag-handle", sf: "bag.fill" },
  { name: "account", title: "Account", icon: "person-circle-outline", active: "person-circle", sf: "person.crop.circle.fill" },
];

function TabsContent() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    tabBarTranslateY,
    activeTabIndex,
    setActiveTabIndex,
    setScrollPageToHandler,
    isPagerScrollEnabled,
  } = useTabBarVisibility();

  const [pageWidth, setPageWidth] = useState(Dimensions.get("window").width);
  const flatListRef = useRef<FlatList<any>>(null);

  // Expose scrollPageTo to context so any child or button can programmatically swipe
  useEffect(() => {
    setScrollPageToHandler((index: number) => {
      setActiveTabIndex(index);
      if (pageWidth > 0) {
        flatListRef.current?.scrollToOffset({ offset: index * pageWidth, animated: true });
      }
    });
  }, [pageWidth]);

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageWidth <= 0) return;
    const offset = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offset / pageWidth);
    if (idx >= 0 && idx < TABS.length && idx !== activeTabIndex) {
      setActiveTabIndex(idx);
    }
  };

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

  const renderPage = (tabName: string) => {
    switch (tabName) {
      case "index":
        return <HomeScreen />;
      case "reels":
        return <Reels />;
      case "cart":
        return <CartScreen />;
      case "account":
        return <Account />;
      default:
        return null;
    }
  };

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.surface }}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && w !== pageWidth) setPageWidth(w);
      }}
    >
      {/* Interactive Carousel Paging for Tabs */}
      <FlatList
        ref={flatListRef}
        data={TABS}
        keyExtractor={(item) => item.name}
        horizontal
        pagingEnabled
        scrollEnabled={isPagerScrollEnabled}
        showsHorizontalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        onMomentumScrollEnd={onMomentumScrollEnd}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews={Platform.OS === "android"}
        renderItem={({ item }) => (
          <View style={{ width: pageWidth, flex: 1 }}>
            {renderPage(item.name)}
          </View>
        )}
      />

      {/* Synchronized Custom Bottom Tab Bar */}
      <Animated.View
        style={[
          {
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-around",
            paddingBottom: insets.bottom > 0 ? insets.bottom : spacing.xs,
            height: insets.bottom > 0 ? insets.bottom + 52 : 60,
          },
          animTabBarStyle,
        ]}
      >
        {TABS.map((t, idx) => {
          const focused = activeTabIndex === idx;
          const color = focused ? colors.brandPrimary : colors.muted;
          return (
            <Pressable
              key={t.name}
              testID={`tab-${t.name}`}
              onPress={() => {
                setActiveTabIndex(idx);
                flatListRef.current?.scrollToOffset({
                  offset: idx * pageWidth,
                  animated: true,
                });
              }}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 6,
                gap: 2,
              }}
            >
              <Ionicons
                name={focused ? t.active : t.icon}
                size={24}
                color={color}
              />
              <Text
                style={{
                  color,
                  fontWeight: "700",
                  fontSize: 11,
                }}
              >
                {t.title}
              </Text>
            </Pressable>
          );
        })}
      </Animated.View>
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
