import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AnimatedPlaceholder } from "@/src/components/animated-placeholder";
import { SellerFullCard, SellerTile } from "@/src/components/seller-card";
import { VegToggle } from "@/src/components/veg-toggle";
import { VoiceSearchModal } from "@/src/components/voice-search-modal";
import { usesNativeTabs } from "@/src/navigation";
import { font, makeStyles, radius, spacing, ThemeColors, useTheme } from "@/src/theme";
import { Address, Seller } from "@/src/types";
import { ErrorState, IconName, Ionicons, Loader, SectionTitle, EndOfListIndicator } from "@/src/ui";
import { useTabBarVisibility } from "@/src/context/tab-bar-visibility";

type Home = { trending: Seller[]; new_shops: Seller[]; nearby: Seller[]; recommended: Seller[]; offers: { code: string; description: string }[] };

const TILES: { key: string; label: string; icon: IconName; bg: keyof ThemeColors; fg: keyof ThemeColors; href?: string }[] = [
  { key: "food", label: "Food", icon: "fast-food-outline", bg: "brandTertiary", fg: "onBrandTertiary", href: "/listing/food" },
  { key: "grocery", label: "Groceries", icon: "basket-outline", bg: "pastelMint", fg: "onPastelMint", href: "/listing/grocery" },
  { key: "new", label: "Discover", icon: "sparkles-outline", bg: "pastelLemon", fg: "onPastelLemon", href: "/listing/new" },
  { key: "group", label: "Group Orders", icon: "people-outline", bg: "pastelLilac", fg: "onPastelLilac", href: "/groups" },
  { key: "community", label: "Apartment", icon: "business-outline", bg: "pastelSky", fg: "onPastelSky", href: "/community" },
  { key: "reels", label: "Bites", icon: "play-circle-outline", bg: "pastelRose", fg: "onPastelRose" },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { tabBarTranslateY, setPagerScrollEnabled, scrollPageTo } = useTabBarVisibility();

  const q = useQuery({ queryKey: ["home"], queryFn: () => api<Home>("/home") });
  const addr = useQuery({ queryKey: ["addresses"], queryFn: () => api<Address[]>("/addresses") });
  const notif = useQuery({ queryKey: ["notifications"], queryFn: () => api<{ unread: number }>("/notifications") });
  const def = addr.data?.find((a) => a.is_default);
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const [vegOnly, setVegOnly] = useState(false);
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const cardLayoutsRef = useRef<{ [key: string]: { y: number; height: number } }>({});

  // Header animation values: animate collapse of address row
  const [locRowHeight, setLocRowHeight] = useState(56);
  const collapseProgress = useSharedValue(0); // 0: fully expanded, 1: fully collapsed

  // Scroll tracking ref to compute delta
  const lastScrollY = useRef(0);
  const isHiddenRef = useRef(false);

  const TIMING_CONFIG = {
    duration: 250,
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentY = e.nativeEvent.contentOffset.y;
    const diff = currentY - lastScrollY.current;

    // Only trigger when scrolled past top padding or pulled down
    if (currentY <= 10) {
      // At the very top, always show header and tab bar
      if (isHiddenRef.current) {
        isHiddenRef.current = false;
        collapseProgress.value = withTiming(0, TIMING_CONFIG);
        tabBarTranslateY.value = withTiming(0, TIMING_CONFIG);
      }
    } else if (diff > 12 && currentY > 50) {
      // User is scrolling content UP (finger moving up) -> hide top address & bottom tab bar
      if (!isHiddenRef.current) {
        isHiddenRef.current = true;
        collapseProgress.value = withTiming(1, TIMING_CONFIG);
        tabBarTranslateY.value = withTiming(100, TIMING_CONFIG);
      }
    } else if (diff < -12) {
      // User is scrolling content DOWN (finger moving down) -> reveal both smoothly
      if (isHiddenRef.current) {
        isHiddenRef.current = false;
        collapseProgress.value = withTiming(0, TIMING_CONFIG);
        tabBarTranslateY.value = withTiming(0, TIMING_CONFIG);
      }
    }

    lastScrollY.current = currentY;

    // Determine which full card is centered / most visible in the viewport
    const viewportHeight = Dimensions.get("window").height;
    const viewportCenter = currentY + viewportHeight / 2;
    let closestId: string | null = null;
    let minDistance = Infinity;

    for (const [id, layout] of Object.entries(cardLayoutsRef.current)) {
      const cardCenter = layout.y + layout.height / 2;
      const distance = Math.abs(viewportCenter - cardCenter);
      // Ensure card is substantially inside the visible area
      const cardTop = layout.y;
      const cardBottom = layout.y + layout.height;
      const isVisible = cardBottom > currentY + 100 && cardTop < currentY + viewportHeight - 100;
      if (isVisible && distance < minDistance) {
        minDistance = distance;
        closestId = id;
      }
    }

    if (closestId !== activeCardId) {
      setActiveCardId(closestId);
    }
  };

  const locRowAnimStyle = useAnimatedStyle(() => {
    const totalShift = locRowHeight + spacing.sm;
    return {
      marginTop: -collapseProgress.value * totalShift,
      opacity: 1 - collapseProgress.value,
    };
  });

  return (
    <View style={s.root}>
      {/* Sticky Top Header */}
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        {/* Address and Notification row that collapses up */}
        <Animated.View
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0) setLocRowHeight(h);
          }}
          style={[s.locRow, locRowAnimStyle]}
        >
          <Pressable testID="home-location-selector" style={{ flex: 1 }} onPress={() => router.push("/addresses")}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="location" size={20} color={colors.brandPrimary} />
              <Text style={s.locLabel}>{def?.label ?? "Add address"}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.onSurface} />
            </View>
            <Text style={s.locLine} numberOfLines={1}>{def?.line ?? "Set your delivery location to see what's nearby"}</Text>
          </Pressable>
          <Pressable testID="home-notifications-button" onPress={() => router.push("/notifications")} style={s.bell}>
            <Ionicons name="notifications-outline" size={22} color={colors.onSurface} />
            {notif.data?.unread ? <View style={s.dot}><Text style={s.dotText}>{Math.min(notif.data.unread, 9)}</Text></View> : null}
          </Pressable>
        </Animated.View>

        {/* Search bar row with Animated Placeholder, Mic, and Veg filter */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Pressable
            testID="home-search-bar"
            onPress={() => router.push(vegOnly ? "/search?veg=1" : "/search")}
            style={[s.search, { flex: 1 }]}
          >
            <Ionicons name="search" size={18} color={colors.muted} />
            <View style={{ flex: 1, height: 46, justifyContent: "center", position: "relative" }}>
              <AnimatedPlaceholder
                placeholders={[
                  "Try 'Biryani'",
                  "Try 'Pizza'",
                  "Try 'Milk'",
                  "Try 'Sweets'",
                  "Try 'Dosa'",
                  "Try 'Organic Vegetables'",
                  "Try 'Burger'",
                ]}
              />
            </View>

            {/* Vertical divider before mic */}
            <View style={{ width: 1, height: 20, backgroundColor: colors.border }} />

            {/* Voice mic option */}
            <Pressable
              testID="home-voice-mic-button"
              onPress={(e) => {
                e.stopPropagation();
                setVoiceModalVisible(true);
              }}
              style={({ pressed }) => [
                { padding: 4, alignItems: "center", justifyContent: "center" },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="mic" size={20} color={colors.brandPrimary} />
            </Pressable>
          </Pressable>

          {/* Veg toggle filter */}
          <VegToggle
            value={vegOnly}
            onToggle={(val) => {
              setVegOnly(val);
            }}
            testID="home-veg-toggle"
          />
        </View>
      </View>

      {/* Voice Search Modal */}
      <VoiceSearchModal
        visible={voiceModalVisible}
        onClose={() => setVoiceModalVisible(false)}
        onTranscript={(spoken) => {
          router.push(`/search?q=${encodeURIComponent(spoken)}${vegOnly ? "&veg=1" : ""}`);
        }}
      />

      {q.isLoading ? <Loader /> : q.isError ? <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} /> : (
        <ScrollView
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: bottomChrome + 80 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); notif.refetch(); }} tintColor={colors.brandPrimary} />}
        >
          <Text style={s.hello}>Hi {user?.name?.split(" ")[0]}, what are we ordering?</Text>
          <View style={s.grid}>
            {TILES.map((t) => (
              <View key={t.key} style={s.tileWrap}>
                <Pressable
                  testID={`home-tile-${t.key}`}
                  onPress={() => {
                    if (t.key === "reels") {
                      // Navigate directly to Bites (index 1 in tabs)
                      scrollPageTo(1);
                    } else if (t.href) {
                      router.push(t.href as any);
                    }
                  }}
                  style={({ pressed }) => [s.tile, { backgroundColor: colors[t.bg] as string }, pressed && { transform: [{ scale: 0.96 }] }]}
                >
                  <Ionicons name={t.icon} size={28} color={colors[t.fg] as string} />
                  <Text style={[s.tileLabel, { color: colors[t.fg] as string }]}>{t.label}</Text>
                </Pressable>
              </View>
            ))}
          </View>

          <Pressable testID="home-schedule-entry" onPress={() => router.push("/listing/food?schedule=1")} style={s.schedule}>
            <View style={s.scheduleIcon}><Ionicons name="time-outline" size={22} color={colors.onPastelLilac} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.schedTitle}>Schedule for later</Text>
              <Text style={s.schedSub}>Dinner at 8, groceries tomorrow morning — pick a slot at checkout</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>

          <SectionTitle title="Offers for you" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            onTouchStart={() => setPagerScrollEnabled(false)}
            onTouchEnd={() => setPagerScrollEnabled(true)}
            onScrollBeginDrag={() => setPagerScrollEnabled(false)}
            onScrollEndDrag={() => setPagerScrollEnabled(true)}
            onMomentumScrollEnd={() => setPagerScrollEnabled(true)}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
          >
            {q.data!.offers.map((o, i) => (
              <View key={o.code} testID={`home-offer-${o.code}`} style={[s.offer, { backgroundColor: [colors.brandTertiary, colors.pastelMint, colors.pastelLilac][i % 3] }]}>
                <Ionicons name="pricetag" size={18} color={colors.brandPrimary} />
                <Text style={s.offerCode}>{o.code}</Text>
                <Text style={s.offerDesc}>{o.description}</Text>
              </View>
            ))}
          </ScrollView>

          <Pressable testID="home-group-banner" onPress={() => router.push("/groups")} style={s.banner}>
            <Image source={{ uri: "https://images.unsplash.com/photo-1547573854-74d2a71d0826?w=900&q=70" }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient colors={["rgba(0,0,0,0.65)", "rgba(0,0,0,0.05)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.bannerInner}>
              <Text style={s.bannerTitle}>Roommates?{"\n"}One cart, everyone's cravings.</Text>
              <View style={s.bannerCta}><Text style={s.bannerCtaText}>Start a group order</Text></View>
            </LinearGradient>
          </Pressable>

          <SectionTitle title="Trending near you" action="See all" testID="home-trending-see-all" onAction={() => router.push("/listing/food")} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            onTouchStart={() => setPagerScrollEnabled(false)}
            onTouchEnd={() => setPagerScrollEnabled(true)}
            onScrollBeginDrag={() => setPagerScrollEnabled(false)}
            onScrollEndDrag={() => setPagerScrollEnabled(true)}
            onMomentumScrollEnd={() => setPagerScrollEnabled(true)}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
          >
            {q.data!.trending.map((sl, i) => <SellerTile key={sl.id} s={sl} rank={i + 1} testID={`home-trending-${sl.id}`} />)}
          </ScrollView>

          <SectionTitle title="Newly opened" action="See all" testID="home-new-see-all" onAction={() => router.push("/listing/new")} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            onTouchStart={() => setPagerScrollEnabled(false)}
            onTouchEnd={() => setPagerScrollEnabled(true)}
            onScrollBeginDrag={() => setPagerScrollEnabled(false)}
            onScrollEndDrag={() => setPagerScrollEnabled(true)}
            onMomentumScrollEnd={() => setPagerScrollEnabled(true)}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
          >
            {q.data!.new_shops.map((sl) => <SellerTile key={sl.id} s={sl} testID={`home-new-${sl.id}`} />)}
          </ScrollView>

          <Pressable testID="home-community-banner" onPress={() => router.push("/community")} style={[s.schedule, { backgroundColor: colors.pastelSky, borderColor: colors.pastelSky }]}>
            <View style={[s.scheduleIcon, { backgroundColor: colors.surface }]}><Ionicons name="business" size={22} color={colors.onPastelSky} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.schedTitle}>Apartment community basket</Text>
              <Text style={s.schedSub}>Neighbours order together, each flat gets its own bill & package</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.onPastelSky} />
          </Pressable>

          <SectionTitle title="Recommended for you" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            onTouchStart={() => setPagerScrollEnabled(false)}
            onTouchEnd={() => setPagerScrollEnabled(true)}
            onScrollBeginDrag={() => setPagerScrollEnabled(false)}
            onScrollEndDrag={() => setPagerScrollEnabled(true)}
            onMomentumScrollEnd={() => setPagerScrollEnabled(true)}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
          >
            {q.data!.recommended.map((sl) => <SellerTile key={sl.id} s={sl} testID={`home-rec-${sl.id}`} />)}
          </ScrollView>

          <SectionTitle title="All shops nearby" />
          {q.data!.nearby.map((sl) => (
            <View
              key={sl.id}
              onLayout={(e) => {
                const layout = e.nativeEvent.layout;
                cardLayoutsRef.current[sl.id] = { y: layout.y, height: layout.height };
                // If no active card yet and nearby shops loaded, set first one as candidate
                if (!activeCardId && q.data?.nearby?.[0]?.id === sl.id) {
                  setActiveCardId(sl.id);
                }
              }}
            >
              <SellerFullCard
                s={sl}
                testID={`home-nearby-${sl.id}`}
                isActive={activeCardId === sl.id}
              />
            </View>
          ))}
          <EndOfListIndicator message="You've explored all shops nearby" />
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: c.surface,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
    overflow: "hidden",
  },
  locRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  locLabel: { fontSize: font.lg + 1, fontWeight: "800", color: c.onSurface },
  locLine: { fontSize: font.sm + 1, color: c.muted, marginTop: 2, marginLeft: 24 },
  bell: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  dotText: { color: c.onBrandPrimary, fontSize: 10, fontWeight: "900" },
  search: { height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, flexDirection: "row", alignItems: "center",
    gap: spacing.sm, paddingHorizontal: spacing.lg, shadowColor: c.onSurface, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  searchText: { color: c.muted, fontSize: font.base + 1 },
  hello: { fontSize: font.xl, fontWeight: "800", color: c.onSurface, paddingHorizontal: spacing.lg, marginTop: spacing.lg, letterSpacing: -0.3 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.md, marginTop: spacing.md },
  tileWrap: { width: "33.33%", padding: spacing.xs },
  tile: { height: 96, borderRadius: radius.md, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  tileLabel: { fontSize: font.sm + 1, fontWeight: "800" },
  schedule: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border,
    flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface },
  scheduleIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.pastelLilac, alignItems: "center", justifyContent: "center" },
  schedTitle: { fontWeight: "800", color: c.onSurface, fontSize: font.base + 1 },
  schedSub: { color: c.muted, fontSize: font.sm, marginTop: 2 },
  offer: { width: 200, padding: spacing.md, borderRadius: radius.md, gap: 4 },
  offerCode: { fontWeight: "900", color: c.onSurface, fontSize: font.lg, letterSpacing: 0.5 },
  offerDesc: { color: c.onSurfaceSecondary, fontSize: font.sm },
  banner: { marginHorizontal: spacing.lg, marginTop: spacing.xl, height: 150, borderRadius: radius.lg, overflow: "hidden", backgroundColor: c.surfaceTertiary },
  bannerInner: { flex: 1, padding: spacing.lg, justifyContent: "space-between" },
  bannerTitle: { color: c.onSurfaceInverse, fontWeight: "800", fontSize: font.lg + 2, lineHeight: 24 },
  bannerCta: { alignSelf: "flex-start", backgroundColor: c.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bannerCtaText: { color: c.onBrandPrimary, fontWeight: "800", fontSize: font.sm + 1 },
}));
