import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useRef, useState, useEffect } from "react";
import {
  Dimensions,
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  RefreshControl,
  ScrollView,
  StatusBar as RNStatusBar,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AnimatedPlaceholder } from "@/src/components/animated-placeholder";
import { SellerFullCard, SellerTile } from "@/src/components/seller-card";
import { VegToggle } from "@/src/components/veg-toggle";
import { VoiceSearchModal } from "@/src/components/voice-search-modal";
import { usesNativeTabs } from "@/src/navigation";
import { font, makeStyles, radius, softShadow, spacing, ThemeColors, tileGradient, useTheme } from "@/src/theme";
import { Address, Seller } from "@/src/types";
import { ErrorState, IconName, Ionicons, Loader, SectionTitle, EndOfListIndicator } from "@/src/ui";
import { useTabBarVisibility } from "@/src/context/tab-bar-visibility";

type Home = { trending: Seller[]; new_shops: Seller[]; nearby: Seller[]; recommended: Seller[]; offers: { code: string; description: string }[] };

const TILES: { key: string; label: string; icon: IconName; bg: keyof ThemeColors; fg: keyof ThemeColors; href?: string }[] = [
  { key: "food", label: "Food", icon: "fast-food-outline", bg: "brandTertiary", fg: "onBrandTertiary", href: "/listing/food" },
  { key: "grocery", label: "Groceries", icon: "basket-outline", bg: "pastelMint", fg: "onPastelMint", href: "/groceries" },
  { key: "new", label: "Discover", icon: "sparkles-outline", bg: "pastelLemon", fg: "onPastelLemon", href: "/listing/new" },
  { key: "group", label: "Group Orders", icon: "people-outline", bg: "pastelLilac", fg: "onPastelLilac", href: "/groups" },
  { key: "community", label: "Apartment", icon: "business-outline", bg: "pastelSky", fg: "onPastelSky", href: "/community" },
  { key: "reels", label: "Bites", icon: "play-circle-outline", bg: "pastelRose", fg: "onPastelRose" },
];

const RECENT_SEARCHES = [
  "Domino's Pizza",
  "Hotel Prabha Veg R...",
  "Nandini Srinivasa ...",
  "Vrs Guntur Tiffins",
  "Jai Ganesh MAEN Re...",
  "Cake 2 Wish Bakery",
  "Deccan Pizza",
  "Real Deepak Punjab...",
];

export interface FoodCategoryItem {
  key: string;
  label: string;
  image: string;
  query: string;
}

const FOOD_CATEGORY_FILTERS: FoodCategoryItem[] = [
  {
    key: "biryani",
    label: "Biryani",
    image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300&q=80",
    query: "Biryani",
  },
  {
    key: "fried_rice",
    label: "Fried rice",
    image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=300&q=80",
    query: "Fried Rice",
  },
  {
    key: "cakes",
    label: "Cakes",
    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=300&q=80",
    query: "Cake",
  },
  {
    key: "burgers",
    label: "Burgers",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&q=80",
    query: "Burger",
  },
  {
    key: "pastry",
    label: "Pastry",
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&q=80",
    query: "Pastry",
  },
  {
    key: "shake",
    label: "Shake",
    image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=300&q=80",
    query: "Shake",
  },
  {
    key: "pizza",
    label: "Pizza",
    image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=300&q=80",
    query: "Pizza",
  },
  {
    key: "dosa",
    label: "Dosa",
    image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=300&q=80",
    query: "Dosa",
  },
  {
    key: "noodles",
    label: "Noodles",
    image: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=300&q=80",
    query: "Noodles",
  },
  {
    key: "rolls",
    label: "Rolls",
    image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=300&q=80",
    query: "Rolls",
  },
  {
    key: "coffee",
    label: "Coffee",
    image: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=300&q=80",
    query: "Coffee",
  },
  {
    key: "thali",
    label: "Thali",
    image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=300&q=80",
    query: "Thali",
  },
  {
    key: "dessert",
    label: "Dessert",
    image: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=300&q=80",
    query: "Dessert",
  },
  {
    key: "icecream",
    label: "Ice Cream",
    image: "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=300&q=80",
    query: "Ice Cream",
  },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const grads = tileGradient(colors);
  const { user } = useAuth();
  const { tabBarTranslateY, setPagerScrollEnabled, scrollPageTo, setIsBottomNavHidden } = useTabBarVisibility();

  const [vegOnly, setVegOnly] = useState(false);

  const q = useQuery({
    queryKey: ["home", vegOnly],
    queryFn: () => api<Home>(`/home${vegOnly ? "?veg_only=true" : ""}`),
  });
  const addr = useQuery({ queryKey: ["addresses"], queryFn: () => api<Address[]>("/addresses") });
  const notif = useQuery({ queryKey: ["notifications"], queryFn: () => api<{ unread: number }>("/notifications") });
  const def = addr.data?.find((a) => a.is_default);
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);
  const [activeCardIds, setActiveCardIds] = useState<string[]>([]);
  const cardLayoutsRef = useRef<{ [key: string]: { y: number; height: number } }>({});

  // Search highlight overlay state
  const [isSearchHighlighted, setIsSearchHighlighted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<any>(null);

  // Dropdown animation progress: 0 (hidden/above) to 1 (dropped down)
  const dropdownAnim = useSharedValue(0);

  // Floating search button animation: 0 (hidden below) to 1 (visible)
  const floatingSearchAnim = useSharedValue(0);

  // Vertical side filter rail state & animations
  const [showVerticalRail, setShowVerticalRail] = useState(false);
  const [isRailCollapsed, setIsRailCollapsed] = useState(false);
  const [railSide, setRailSide] = useState<"right" | "left">("right");
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const railCollapseAnim = useSharedValue(0); // 0: expanded, 1: collapsed
  const railProgress = useSharedValue(0); // 0: outside nearby, 1: inside nearby

  // Track position of "All shops nearby"
  const nearbySectionY = useRef<number>(9999);

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

  const openSearchHighlight = () => {
    setIsSearchHighlighted(true);
    setIsBottomNavHidden(true);
    dropdownAnim.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
  };

  const closeSearchHighlight = () => {
    Keyboard.dismiss();
    setIsBottomNavHidden(false);
    dropdownAnim.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) });
    setTimeout(() => {
      setIsSearchHighlighted(false);
      setSearchQuery("");
    }, 220);
  };

  const handleSelectRecentSearch = (item: string) => {
    // Clean trailing dots if any, or push to search screen
    const clean = item.replace(/\.+$/, "");
    closeSearchHighlight();
    router.push(`/search?q=${encodeURIComponent(clean)}${vegOnly ? "&veg=1" : ""}`);
  };

  const toggleRailCollapse = () => {
    if (isRailCollapsed) {
      setIsRailCollapsed(false);
      railCollapseAnim.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
    } else {
      setIsRailCollapsed(true);
      railCollapseAnim.value = withTiming(1, { duration: 250, easing: Easing.in(Easing.cubic) });
    }
  };

  const toggleRailSide = () => {
    setRailSide((prev) => (prev === "right" ? "left" : "right"));
  };

  const handleFilterSelect = (item: FoodCategoryItem) => {
    if (selectedFilter === item.key) {
      setSelectedFilter(null);
    } else {
      setSelectedFilter(item.key);
      router.push(`/search?q=${encodeURIComponent(item.query)}${vegOnly ? "&veg=1" : ""}`);
    }
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentY = e.nativeEvent.contentOffset.y;
    const diff = currentY - lastScrollY.current;

    // Trigger vertical rail when scrolled into or past "All shops nearby"
    const inNearby = currentY >= nearbySectionY.current - 120;
    if (inNearby && !showVerticalRail) {
      setShowVerticalRail(true);
      railProgress.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
    } else if (!inNearby && showVerticalRail) {
      setShowVerticalRail(false);
      railProgress.value = withTiming(0, { duration: 250, easing: Easing.in(Easing.cubic) });
    }

    // Only trigger when scrolled past top padding or pulled down
    if (currentY <= 10) {
      // At the very top, always show header and tab bar
      if (isHiddenRef.current) {
        isHiddenRef.current = false;
        collapseProgress.value = withTiming(0, TIMING_CONFIG);
        tabBarTranslateY.value = withTiming(0, TIMING_CONFIG);
        floatingSearchAnim.value = withTiming(0, TIMING_CONFIG);
      }
    } else if (diff > 12 && currentY > 50) {
      // User is scrolling content UP (finger moving up) -> hide top address & bottom tab bar
      if (!isHiddenRef.current) {
        isHiddenRef.current = true;
        collapseProgress.value = withTiming(1, TIMING_CONFIG);
        tabBarTranslateY.value = withTiming(100, TIMING_CONFIG);
        floatingSearchAnim.value = withTiming(1, TIMING_CONFIG);
      }
    } else if (diff < -12) {
      // User is scrolling content DOWN (finger moving down) -> reveal both smoothly
      if (isHiddenRef.current) {
        isHiddenRef.current = false;
        collapseProgress.value = withTiming(0, TIMING_CONFIG);
        tabBarTranslateY.value = withTiming(0, TIMING_CONFIG);
        floatingSearchAnim.value = withTiming(0, TIMING_CONFIG);
      }
    }

    lastScrollY.current = currentY;

    // Determine which full cards are visible in the viewport:
    // If a card's full height is completely visible on screen, it is active.
    // If multiple cards are fully visible, all of them animate simultaneously.
    const viewportHeight = Dimensions.get("window").height;
    // Visible viewport boundaries considering top header (~120px) and bottom bar (~70px)
    const headerThreshold = 80;
    const bottomThreshold = 70;
    const visibleTop = currentY + insets.top + headerThreshold;
    const visibleBottom = currentY + viewportHeight - (bottomChrome || insets.bottom) - bottomThreshold;

    const nearbyStart = nearbySectionY.current;
    const fullyVisibleIds: string[] = [];
    let closestId: string | null = null;
    let minDistance = Infinity;
    const viewportCenter = currentY + viewportHeight / 2;

    for (const [id, layout] of Object.entries(cardLayoutsRef.current)) {
      const cardTop = nearbyStart + layout.y;
      const cardBottom = cardTop + layout.height;
      const cardCenter = cardTop + layout.height / 2;
      const distance = Math.abs(viewportCenter - cardCenter);

      // Card is completely visible if its top >= visibleTop and bottom <= visibleBottom
      if (cardTop >= visibleTop - 20 && cardBottom <= visibleBottom + 20) {
        fullyVisibleIds.push(id);
      }

      // Fallback tracking for closest card in case no single card is 100% in bounds
      if (cardBottom > visibleTop && cardTop < visibleBottom && distance < minDistance) {
        minDistance = distance;
        closestId = id;
      }
    }

    const nextActiveIds = fullyVisibleIds.length > 0 ? fullyVisibleIds : (closestId ? [closestId] : []);
    setActiveCardIds((prev) => {
      if (prev.length === nextActiveIds.length && prev.every((id) => nextActiveIds.includes(id))) {
        return prev;
      }
      return nextActiveIds;
    });
  };

  const locRowAnimStyle = useAnimatedStyle(() => {
    const totalShift = locRowHeight + spacing.sm;
    return {
      marginTop: -collapseProgress.value * totalShift,
      opacity: 1 - collapseProgress.value,
    };
  });

  const floatingBtnAnimStyle = useAnimatedStyle(() => {
    return {
      opacity: floatingSearchAnim.value,
      transform: [
        { translateY: interpolate(floatingSearchAnim.value, [0, 1], [40, 0]) },
        { scale: interpolate(floatingSearchAnim.value, [0, 1], [0.85, 1]) },
      ],
      pointerEvents: floatingSearchAnim.value > 0.5 ? ("auto" as const) : ("none" as const),
    };
  });

  const dropdownAnimStyle = useAnimatedStyle(() => {
    return {
      opacity: dropdownAnim.value,
      transform: [
        { translateY: interpolate(dropdownAnim.value, [0, 1], [-25, 0]) },
      ],
    };
  });

  const backdropAnimStyle = useAnimatedStyle(() => {
    return {
      opacity: dropdownAnim.value,
    };
  });

  const verticalRailAnimStyle = useAnimatedStyle(() => {
    // Header collapsed height: insets.top + paddingTop(spacing.sm) + searchRow marginTop(4) + search height(50) + paddingBottom(spacing.lg)
    const collapsedHeaderHeight = insets.top + spacing.sm + 4 + 50 + spacing.lg;
    const addressRowHeight = locRowHeight > 0 ? locRowHeight + spacing.sm : 64;
    const headerBottom = collapsedHeaderHeight + (1 - collapseProgress.value) * addressRowHeight;
    const computedTop = headerBottom + spacing.md;

    const tabHeight = 62;
    const currentTabVisibleOffset = Math.max(0, tabHeight - tabBarTranslateY.value);
    const computedBottom = (bottomChrome || insets.bottom) + currentTabVisibleOffset + 28;

    const directionMultiplier = railSide === "left" ? -1 : 1;
    const baseOffset = (1 - railProgress.value) * 140 * directionMultiplier;
    const collapseOffset = railCollapseAnim.value * 110 * directionMultiplier;

    return {
      top: computedTop,
      bottom: computedBottom,
      opacity: railProgress.value,
      transform: [
        { translateX: baseOffset + collapseOffset },
      ],
      pointerEvents: railProgress.value > 0.3 && railCollapseAnim.value < 0.8 ? ("auto" as const) : ("none" as const),
    };
  }, [railSide]);

  const reopenPillAnimStyle = useAnimatedStyle(() => {
    const isShown = railProgress.value * railCollapseAnim.value;
    const tabHeight = 62;
    const currentTabVisibleOffset = Math.max(0, tabHeight - tabBarTranslateY.value);
    const computedBottom = (bottomChrome || insets.bottom) + currentTabVisibleOffset + 28;

    const offscreenDistance = railSide === "left" ? -40 : 40;

    return {
      bottom: computedBottom,
      opacity: isShown,
      transform: [
        { translateX: interpolate(isShown, [0, 1], [offscreenDistance, 0]) },
      ],
      pointerEvents: isShown > 0.5 ? ("auto" as const) : ("none" as const),
    };
  }, [railSide]);


  const nearbyContainerAnimStyle = useAnimatedStyle(() => {
    // Shrunk state: railProgress is 1 and railCollapseAnim is 0
    const activeOpen = railProgress.value * (1 - railCollapseAnim.value);
    // When rail is active, animate the side padding from 0 to 104 (82px rail width + 12px screen margin + 10px clear gap)
    const targetPadding = interpolate(activeOpen, [0, 1], [0, 104]);

    return {
      paddingLeft: railSide === "left" ? targetPadding : 0,
      paddingRight: railSide === "right" ? targetPadding : 0,
    };
  }, [railSide]);

  useEffect(() => {
    if (Platform.OS === "android") {
      (RNStatusBar as any).setTranslucent?.(true);
      (RNStatusBar as any).setBackgroundColor?.("transparent", true);
    }
  }, []);

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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={s.pinWrap}>
                <Ionicons name="location" size={16} color={colors.brandPrimary} />
              </View>
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 4 }}>
          <Pressable
            testID="home-search-bar"
            onPress={openSearchHighlight}
            style={[s.search, { flex: 1 }]}
          >
            <Ionicons name="search" size={18} color={colors.brandPrimary} />
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
            <View style={{ width: 1, height: 20, backgroundColor: "rgba(255, 128, 25, 0.15)" }} />

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

          {/* Veg toggle filter - hidden when search is highlighted */}
          {!isSearchHighlighted && (
            <VegToggle
              value={vegOnly}
              onToggle={(val) => {
                setVegOnly(val);
              }}
              testID="home-veg-toggle"
            />
          )}
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
                      scrollPageTo(1);
                    } else if (t.href) {
                      router.push(t.href as any);
                    }
                  }}
                  style={({ pressed }) => [s.tile, s.tileShadow, pressed && { transform: [{ scale: 0.96 }] }]}
                >
                  <LinearGradient
                    colors={grads[t.bg] || [colors[t.bg] as string, colors[t.bg] as string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={s.tileIcon}>
                    <Ionicons name={t.icon} size={24} color={colors[t.fg] as string} />
                  </View>
                  <Text style={[s.tileLabel, { color: colors[t.fg] as string }]}>{t.label}</Text>
                </Pressable>
              </View>
            ))}
          </View>

          <Pressable testID="home-schedule-entry" onPress={() => router.push("/listing/food?schedule=1")} style={s.scheduleCard}>
            <View style={s.scheduleIconBox}>
              <Ionicons name="time-outline" size={24} color="#5B21B6" />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={s.scheduleTitle}>Schedule for later</Text>
              <Text style={s.scheduleSub}>Dinner at 8, groceries tomorrow morning — pick a slot at checkout</Text>
            </View>
            <View style={s.scheduleChevronCircle}>
              <Ionicons name="chevron-forward" size={18} color="#5B21B6" />
            </View>
          </Pressable>

          {/* Veg mode message banner */}
          {vegOnly && (
            <View style={s.vegBanner}>
              <Ionicons name="leaf" size={16} color="#15803D" />
              <Text style={s.vegBannerText}>
                {q.isFetching ? "Filtering..." : "Veg mode on · showing shops with veg options"}
              </Text>
            </View>
          )}

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
            style={s.offersScroll}
            contentContainerStyle={s.offersScrollContent}
          >
            {q.data!.offers.map((o, i) => {
              const offerGradients = [
                grads.brandTertiary,
                grads.pastelMint,
                grads.pastelLilac,
              ];
              const grad = offerGradients[i % offerGradients.length];
              return (
                <View key={o.code} testID={`home-offer-${o.code}`} style={[s.offer, s.offerShadow]}>
                  <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                  <View style={s.offerIconWrap}>
                    <Ionicons name="pricetag" size={14} color={colors.brandPrimary} />
                  </View>
                  <Text style={s.offerCode}>{o.code}</Text>
                  <Text style={s.offerDesc}>{o.description}</Text>
                </View>
              );
            })}
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

          <Pressable testID="home-community-banner" onPress={() => router.push("/community")} style={s.communityCard}>
            <View style={s.communityIconBox}>
              <Ionicons name="business" size={26} color="#1D5C8A" />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={s.communityTitle}>Apartment community basket</Text>
              <Text style={s.communitySub}>Neighbours order together, each flat gets its own bill & package</Text>
            </View>
            <View style={s.communityChevronCircle}>
              <Ionicons name="chevron-forward" size={18} color="#1D5C8A" />
            </View>
          </Pressable>

          {/* Food Category Carousel Filters (Horizontal above Recommended section) */}
          <SectionTitle title="What's on your mind?" />
          <View style={s.foodFilterSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled
              onTouchStart={() => setPagerScrollEnabled(false)}
              onTouchEnd={() => setPagerScrollEnabled(true)}
              onScrollBeginDrag={() => setPagerScrollEnabled(false)}
              onScrollEndDrag={() => setPagerScrollEnabled(true)}
              onMomentumScrollEnd={() => setPagerScrollEnabled(true)}
              contentContainerStyle={s.foodFilterScrollContent}
            >
              {FOOD_CATEGORY_FILTERS.map((cat) => {
                const isSelected = selectedFilter === cat.key;
                return (
                  <Pressable
                    key={cat.key}
                    testID={`home-food-filter-${cat.key}`}
                    onPress={() => handleFilterSelect(cat)}
                    style={({ pressed }) => [
                      s.foodFilterItem,
                      pressed && { transform: [{ scale: 0.95 }] },
                    ]}
                  >
                    <View style={[s.foodImageRing, isSelected && s.foodImageRingActive]}>
                      <Image
                        source={{ uri: cat.image }}
                        style={s.foodImage}
                        contentFit="cover"
                        transition={200}
                      />
                    </View>
                    <Text
                      style={[s.foodFilterLabel, isSelected && s.foodFilterLabelActive]}
                      numberOfLines={1}
                    >
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

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

          <View
            onLayout={(e) => {
              nearbySectionY.current = e.nativeEvent.layout.y;
            }}
          >
            <SectionTitle title="All shops nearby" />
          </View>
          <Animated.View
            style={nearbyContainerAnimStyle}
          >
            {q.data!.nearby.map((sl) => (
              <View
                key={sl.id}
                onLayout={(e) => {
                  const layout = e.nativeEvent.layout;
                  cardLayoutsRef.current[sl.id] = { y: layout.y, height: layout.height };
                  // If no active card yet and nearby shops loaded, set first one as candidate
                  if (activeCardIds.length === 0 && q.data?.nearby?.[0]?.id === sl.id) {
                    setActiveCardIds([sl.id]);
                  }
                }}
              >
                <SellerFullCard
                  s={sl}
                  testID={`home-nearby-${sl.id}`}
                  isActive={activeCardIds.includes(sl.id)}
                  isRailOpen={showVerticalRail && !isRailCollapsed}
                />
              </View>
            ))}
            <EndOfListIndicator message="You've explored all shops nearby" />
          </Animated.View>
        </ScrollView>
      )}

      {/* Floating Vertical Food Category Rail (shows only when in "All shops nearby" section) */}
      {showVerticalRail && (
        <Animated.View
          style={[
            s.verticalRailWrapper,
            railSide === "left" ? s.railLeftWrapper : s.railRightWrapper,
            verticalRailAnimStyle,
          ]}
        >
          {/* Main vertical rail card */}
          <View style={s.verticalRailCard}>
            {/* Top action header: Swap side button */}
            <View style={s.railHeaderBar}>
              <Pressable
                testID="rail-switch-side-button"
                onPress={toggleRailSide}
                hitSlop={8}
                style={({ pressed }) => [
                  s.railSwitchBtn,
                  pressed && { opacity: 0.7, transform: [{ scale: 0.92 }] },
                ]}
              >
                <Ionicons
                  name={railSide === "right" ? "arrow-back-outline" : "arrow-forward-outline"}
                  size={14}
                  color={colors.brandPrimary}
                />
                <Text style={s.railSwitchText}>{railSide === "right" ? "Left" : "Right"}</Text>
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              contentContainerStyle={s.verticalRailScroll}
            >
              {FOOD_CATEGORY_FILTERS.map((cat) => {
                const isSelected = selectedFilter === cat.key;
                return (
                  <Pressable
                    key={cat.key}
                    testID={`rail-filter-${cat.key}`}
                    onPress={() => handleFilterSelect(cat)}
                    style={({ pressed }) => [
                      s.railItem,
                      pressed && { transform: [{ scale: 0.92 }] },
                    ]}
                  >
                    <View style={[s.railImageRing, isSelected && s.railImageRingActive]}>
                      <Image
                        source={{ uri: cat.image }}
                        style={s.railImage}
                        contentFit="cover"
                        transition={150}
                      />
                    </View>
                    <Text
                      style={[s.railLabel, isSelected && s.railLabelActive]}
                      numberOfLines={1}
                    >
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Separate Bottom Card with chevron arrow and "Close" text */}
          <Pressable
            testID="rail-toggle-bottom-button"
            onPress={toggleRailCollapse}
            hitSlop={10}
            style={({ pressed }) => [
              s.railCloseCard,
              pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] },
            ]}
          >
            <Ionicons
              name={railSide === "right" ? "chevron-forward" : "chevron-back"}
              size={16}
              color={colors.onSurface}
            />
            <Text style={s.railCloseText}>Close</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Floating Reopen Button at screen edge when collapsed */}
      {showVerticalRail && (
        <Animated.View
          style={[
            s.reopenPillContainer,
            railSide === "left" ? s.reopenPillLeft : s.reopenPillRight,
            reopenPillAnimStyle,
          ]}
        >
          <Pressable
            testID="rail-reopen-pill-button"
            onPress={toggleRailCollapse}
            hitSlop={10}
            style={({ pressed }) => [
              s.reopenPill,
              railSide === "left" ? s.reopenPillShapeLeft : s.reopenPillShapeRight,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Ionicons
              name={railSide === "right" ? "chevron-back" : "chevron-forward"}
              size={18}
              color={colors.onSurface}
            />
          </Pressable>
        </Animated.View>
      )}

      {/* Floating Bottom Search Button (appears when tab bar is hidden during scroll down) */}
      <Animated.View
        style={[
          s.floatingSearchContainer,
          { bottom: (bottomChrome || insets.bottom) + 20 },
          floatingBtnAnimStyle,
        ]}
      >
        <Pressable
          testID="floating-bottom-search-button"
          onPress={openSearchHighlight}
          style={({ pressed }) => [
            s.floatingSearchPill,
            pressed && { transform: [{ scale: 0.94 }] },
          ]}
        >
          <Ionicons name="search" size={17} color="#FFFFFF" />
          <Text style={s.floatingSearchText}>Search</Text>
        </Pressable>
      </Animated.View>

      {/* Highlighted Search Overlay matching reference */}
      {isSearchHighlighted && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Dimmed backdrop over shops feed */}
          <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, backdropAnimStyle]}>
            <View
              style={StyleSheet.absoluteFill}
              onStartShouldSetResponder={() => true}
              onResponderGrant={closeSearchHighlight}
            />
          </Animated.View>

          {/* Top Search Card and Dropdown Panel */}
          <Animated.View style={[s.highlightOverlayContainer, dropdownAnimStyle]}>
            <View style={[s.highlightWhiteCard, { paddingTop: insets.top + spacing.xs }]}>
              {/* Header: Back arrow + "Search for dishes & restaurants" */}
              <View style={s.highlightHeaderRow}>
                <Pressable
                  testID="highlight-search-back-button"
                  onPressIn={closeSearchHighlight}
                  onPress={closeSearchHighlight}
                  hitSlop={16}
                  style={s.highlightBackBtn}
                >
                  <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
                </Pressable>
                <Pressable onPressIn={closeSearchHighlight} onPress={closeSearchHighlight} style={{ flex: 1 }}>
                  <Text style={s.highlightHeaderTitle}>Search for dishes & restaurants</Text>
                </Pressable>
              </View>

              {/* Search Input Bar with Orange Cursor, Animated Placeholder Tips, and Mic */}
              <View style={s.highlightSearchBar}>
                <Ionicons name="search" size={18} color={colors.brandPrimary} />
                <View style={{ flex: 1, height: 46, justifyContent: "center" }}>
                  <TextInput
                    ref={searchInputRef}
                    autoFocus
                    style={s.highlightSearchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search for restaurants, groceries, dishes..."
                    placeholderTextColor={colors.muted}
                    cursorColor={colors.brandPrimary}
                    selectionColor={colors.brandPrimary}
                    returnKeyType="search"
                    onSubmitEditing={() => {
                      if (searchQuery.trim()) {
                        closeSearchHighlight();
                        router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}${vegOnly ? "&veg=1" : ""}`);
                      }
                    }}
                  />
                </View>

                {/* Vertical divider */}
                <View style={{ width: 1, height: 20, backgroundColor: "rgba(255, 128, 25, 0.15)", marginHorizontal: 4 }} />

                {searchQuery.length > 0 ? (
                  <Pressable onPress={() => setSearchQuery("")} hitSlop={8} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={18} color={colors.muted} />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => {
                      closeSearchHighlight();
                      setVoiceModalVisible(true);
                    }}
                    hitSlop={8}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="mic" size={20} color={colors.brandPrimary} />
                  </Pressable>
                )}
              </View>

              {/* RECENTLY SEARCHED RESTAURANTS Section Header with Divider */}
              <View style={s.recentHeaderRow}>
                <Text style={s.recentHeaderTitle}>RECENTLY SEARCHED RESTAURANTS</Text>
                <View style={s.recentDivider} />
              </View>

              {/* Chips / Pills wrapping in rows with Clock Icon */}
              <View style={s.recentChipsWrap}>
                {RECENT_SEARCHES.map((item, idx) => (
                  <Pressable
                    key={idx}
                    testID={`recent-search-chip-${idx}`}
                    onPress={() => handleSelectRecentSearch(item)}
                    style={({ pressed }) => [
                      s.recentChip,
                      pressed && { backgroundColor: colors.surfaceSecondary, transform: [{ scale: 0.96 }] },
                    ]}
                  >
                    <Ionicons name="time-outline" size={14} color={colors.muted} />
                    <Text style={s.recentChipText} numberOfLines={1}>{item}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: c.surface,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
    overflow: "hidden",
  },
  blob: { position: "absolute", borderRadius: 999 },
  locRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  pinWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255, 255, 255, 0.9)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.6)" },
  locLabel: { fontSize: font.lg + 1, fontWeight: "800", color: c.onSurface, letterSpacing: -0.2 },
  locLine: { fontSize: font.sm + 1, color: c.muted, marginTop: 4, marginLeft: 34 },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: c.onSurface,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  dot: { position: "absolute", top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: c.surface },
  dotText: { color: c.onBrandPrimary, fontSize: 9, fontWeight: "900" },
  search: {
    height: 50,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    shadowColor: c.onSurface,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  searchText: { color: c.muted, fontSize: font.base + 1 },
  hello: { fontSize: font.xl, fontWeight: "800", color: c.onSurface, paddingHorizontal: spacing.lg, marginTop: spacing.lg, letterSpacing: -0.3 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.md, marginTop: spacing.sm },
  tileWrap: { width: "33.33%", padding: spacing.xs },
  tile: {
    height: 104,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.7)",
  },
  tileShadow: {
    shadowColor: "#FC8019",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
  },
  tileLabel: { fontSize: font.sm + 1, fontWeight: "800", letterSpacing: -0.2 },
  glassCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: c.surface,
    shadowColor: "#FC8019",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 2,
  },
  cardIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  chevronPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  schedule: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border,
    flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface },
  scheduleIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.pastelLilac, alignItems: "center", justifyContent: "center" },
  schedTitle: { fontWeight: "800", color: c.onSurface, fontSize: font.base + 1 },
  schedSub: { color: c.muted, fontSize: font.sm, marginTop: 2 },
  scheduleCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#FFFFFF",
    shadowColor: "#FC8019",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 2,
  },
  scheduleIconBox: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#F3EEFD",
    alignItems: "center",
    justifyContent: "center",
  },
  scheduleTitle: {
    fontWeight: "800",
    color: "#111111",
    fontSize: font.base + 1,
    letterSpacing: -0.2,
  },
  scheduleSub: {
    color: "#7E8B9B",
    fontSize: font.sm,
    lineHeight: 18,
  },
  scheduleChevronCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3EEFD",
    alignItems: "center",
    justifyContent: "center",
  },
  communityCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#FFFFFF",
    shadowColor: "#FC8019",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 2,
  },
  communityIconBox: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#EBF3F9",
    alignItems: "center",
    justifyContent: "center",
  },
  communityTitle: {
    fontWeight: "800",
    color: "#111111",
    fontSize: font.base + 1,
    letterSpacing: -0.2,
  },
  communitySub: {
    color: "#7E8B9B",
    fontSize: font.sm,
    lineHeight: 18,
  },
  communityChevronCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EBF3F9",
    alignItems: "center",
    justifyContent: "center",
  },
  vegBanner: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: "#E8F5E9",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#C8E6C9",
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  vegBannerText: {
    fontSize: font.sm,
    fontWeight: "700",
    color: "#1E5E2C",
    flexShrink: 1,
  },
  offersScroll: {
    overflow: "visible",
  },
  offersScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: 4,
    paddingBottom: 16,
    gap: spacing.md,
  },
  offer: {
    width: 210,
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.75)",
  },
  offerShadow: {
    shadowColor: "#FC8019",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  offerIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  offerCode: { fontWeight: "900", color: c.onSurface, fontSize: font.lg, letterSpacing: 0.5 },
  offerDesc: { color: c.onSurfaceSecondary, fontSize: font.sm },
  banner: { marginHorizontal: spacing.lg, marginTop: spacing.lg, height: 150, borderRadius: radius.lg, overflow: "hidden", backgroundColor: c.surfaceTertiary },
  bannerInner: { flex: 1, padding: spacing.lg, justifyContent: "space-between" },
  bannerTitle: { color: c.onSurfaceInverse, fontWeight: "800", fontSize: font.lg + 2, lineHeight: 24 },
  bannerCta: { alignSelf: "flex-start", backgroundColor: c.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bannerCtaText: { color: c.onBrandPrimary, fontWeight: "800", fontSize: font.sm + 1 },

  // Floating bottom search button
  floatingSearchContainer: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 99,
  },
  floatingSearchPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(35, 38, 42, 0.88)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  floatingSearchText: {
    color: "#FFFFFF",
    fontSize: font.base,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  // Highlighted Search Modal styles
  backdrop: {
    backgroundColor: "rgba(0, 0, 0, 0.62)",
    zIndex: 100,
  },
  highlightOverlayContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 101,
  },
  highlightWhiteCard: {
    backgroundColor: c.surface,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  highlightHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  highlightBackBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  highlightHeaderTitle: {
    fontSize: font.base + 2,
    fontWeight: "600",
    color: c.onSurface,
  },
  highlightSearchBar: {
    height: 50,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
    shadowColor: c.onSurface,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  highlightSearchInput: {
    flex: 1,
    fontSize: font.base + 1,
    color: c.onSurface,
    paddingVertical: 0,
    paddingRight: 4,
  },
  recentHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.lg + 2,
    marginBottom: spacing.md,
  },
  recentHeaderTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: c.muted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  recentDivider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.border,
    marginLeft: spacing.md,
  },
  recentChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingTop: 2,
  },
  recentChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
    maxWidth: "50%",
  },
  recentChipText: {
    fontSize: font.sm,
    color: c.onSurface,
    fontWeight: "500",
  },

  // Horizontal Food Filter Carousel
  foodFilterSection: {
    marginTop: 0,
    marginBottom: spacing.xs,
  },
  foodFilterScrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  foodFilterItem: {
    alignItems: "center",
    width: 76,
  },
  foodImageRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 3,
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  foodImageRingActive: {
    borderColor: c.brandPrimary,
    backgroundColor: c.pastelLemon,
  },
  foodImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  foodFilterLabel: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "600",
    color: c.onSurfaceSecondary,
    textAlign: "center",
  },
  foodFilterLabelActive: {
    color: c.brandPrimary,
    fontWeight: "800",
  },

  // Floating Vertical Rail on left or right
  verticalRailWrapper: {
    position: "absolute",
    zIndex: 90,
    gap: 8,
  },
  railRightWrapper: {
    right: 12,
  },
  railLeftWrapper: {
    left: 12,
  },
  verticalRailCard: {
    width: 82,
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: 24,
    paddingTop: 6,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    borderWidth: 1,
    borderColor: c.border,
    overflow: "hidden",
  },
  railHeaderBar: {
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.divider,
    marginBottom: 4,
  },
  railSwitchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: c.brandTertiary,
  },
  railSwitchText: {
    fontSize: 10,
    fontWeight: "800",
    color: c.brandPrimary,
  },
  verticalRailScroll: {
    alignItems: "center",
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    gap: 14,
  },
  railItem: {
    alignItems: "center",
    width: 68,
  },
  railImageRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    padding: 2,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  railImageRingActive: {
    borderColor: c.brandPrimary,
  },
  railImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  railLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "600",
    color: c.onSurfaceSecondary,
    textAlign: "center",
  },
  railLabelActive: {
    color: c.brandPrimary,
    fontWeight: "800",
  },
  railCloseCard: {
    width: 82,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  railCloseText: {
    fontSize: 12,
    fontWeight: "700",
    color: c.onSurface,
  },
  reopenPillContainer: {
    position: "absolute",
    zIndex: 90,
  },
  reopenPillRight: {
    right: 0,
  },
  reopenPillLeft: {
    left: 0,
  },
  reopenPill: {
    backgroundColor: c.surface,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  reopenPillShapeRight: {
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    borderRightWidth: 0,
    shadowOffset: { width: -2, height: 2 },
  },
  reopenPillShapeLeft: {
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderLeftWidth: 0,
    shadowOffset: { width: 2, height: 2 },
  },
}));
