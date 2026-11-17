import { useQuery } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
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
  runOnJS,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { mediaUri } from "@/src/format";
import { AnimatedPlaceholder } from "@/src/components/animated-placeholder";
import { SellerFullCard, SellerTile } from "@/src/components/seller-card";
import { VegToggle } from "@/src/components/veg-toggle";
import { VoiceSearchModal } from "@/src/components/voice-search-modal";
import { FloatingCartBar } from "@/src/components/floating-cart-bar";
import { BrandFooter } from "@/src/components/brand-footer";
import { HomeSkeleton } from "@/src/components/home-skeleton";
import { usesNativeTabs } from "@/src/navigation";
import { font, makeStyles, radius, softShadow, spacing, ThemeColors, tileGradient, useTheme } from "@/src/theme";
import { Address, Seller } from "@/src/types";
import { ErrorState, IconName, Ionicons, Loader, SectionTitle, EndOfListIndicator } from "@/src/ui";
import { useTabBarVisibility } from "@/src/context/tab-bar-visibility";

type Home = {
  trending: Seller[];
  new_shops: Seller[];
  nearby: Seller[];
  recommended: Seller[];
  offers: { code: string; description: string }[];
  home_banner?: {
    image_url: string;
    title?: string;
    subtitle?: string;
  };
};

const TILES: {
  key: string;
  label: string;
  sub: string;
  icon: IconName;
  iconBg: string;
  iconColor: string;
  cardBg: readonly [string, string, ...string[]];
  borderColor: string;
  href?: string;
}[] = [
    {
      key: "food",
      label: "Food",
      sub: "Restaurants & meals",
      icon: "restaurant",
      iconBg: "#FFEDD5",
      iconColor: "#F43F5E",
      cardBg: ["#FFF7ED", "#FFFFFF"],
      borderColor: "#FFEDD5",
      href: "/listing/food",
    },
    {
      key: "grocery",
      label: "Groceries",
      sub: "Daily essentials",
      icon: "basket",
      iconBg: "#DCFCE7",
      iconColor: "#16A34A",
      cardBg: ["#F0FDF4", "#FFFFFF"],
      borderColor: "#DCFCE7",
      href: "/groceries",
    },
    {
      key: "new",
      label: "Discover",
      sub: "New & trending",
      icon: "sparkles",
      iconBg: "#FEF9C3",
      iconColor: "#CA8A04",
      cardBg: ["#FEFCE8", "#FFFFFF"],
      borderColor: "#FEF9C3",
      href: "/listing/new",
    },
    {
      key: "group",
      label: "Group Orders",
      sub: "Order together & save",
      icon: "people",
      iconBg: "#EDE9FE",
      iconColor: "#7C3AED",
      cardBg: ["#FAF5FF", "#FFFFFF"],
      borderColor: "#EDE9FE",
      href: "/groups",
    },
    {
      key: "community",
      label: "Apartment",
      sub: "Your community orders",
      icon: "business",
      iconBg: "#E0F2FE",
      iconColor: "#0284C7",
      cardBg: ["#F0F9FF", "#FFFFFF"],
      borderColor: "#E0F2FE",
      href: "/community",
    },
    {
      key: "reels",
      label: "Bites",
      sub: "Short food & shop videos",
      icon: "play",
      iconBg: "#FCE7F3",
      iconColor: "#DB2777",
      cardBg: ["#FDF2F8", "#FFFFFF"],
      borderColor: "#FCE7F3",
      href: "/reels",
    },
  ];

const AD_BANNERS = [
  {
    key: "roommates",
    title: "Roommates?\nOne cart, everyone's cravings.",
    cta: "Start a group order",
    href: "/groups",
    image: "https://images.unsplash.com/photo-1547573854-74d2a71d0826?w=900&q=70",
    gradColors: ["rgba(0,0,0,0.72)", "rgba(0,0,0,0.1)"] as const,
  },
  {
    key: "community",
    title: "Apartment Basket\nOrder together, separate delivery.",
    cta: "Join basket",
    href: "/community",
    image: "https://images.unsplash.com/photo-1543083477-4f785aeafaa9?w=900&q=70",
    gradColors: ["rgba(15,23,42,0.75)", "rgba(15,23,42,0.15)"] as const,
  },
  {
    key: "fresh",
    title: "Fresh Groceries Daily\nDirect from verified local stores.",
    cta: "Shop fresh",
    href: "/groceries",
    image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=900&q=70",
    gradColors: ["rgba(20,83,45,0.75)", "rgba(20,83,45,0.15)"] as const,
  },
  {
    key: "schedule",
    title: "Plan Ahead\nSchedule meals for exact slot delivery.",
    cta: "Schedule now",
    href: "/listing/food?schedule=1",
    image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=900&q=70",
    gradColors: ["rgba(67,24,107,0.75)", "rgba(67,24,107,0.15)"] as const,
  },
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
  image: any;
  query: string;
  bgColor: string;
}

const WHAT_ON_MIND_PILLS = [
  { key: "cuisines", label: "Cuisines", icon: "cuisines" },
  { key: "meals", label: "Meals", icon: "meals" },
  { key: "occasions", label: "Occasions", icon: "calendar-outline" },
  { key: "nearby", label: "Nearby", icon: "location-outline" },
  { key: "more", label: "More", icon: "ellipsis-horizontal" },
] as const;

const CUISINES_FOOD_ITEMS: FoodCategoryItem[] = [
  {
    key: "biryani",
    label: "Biryani",
    image: require("@/assets/images/categories/biryani_trans.png"),
    query: "Biryani",
    bgColor: "#FEECDE",
  },
  {
    key: "burgers",
    label: "Burgers",
    image: require("@/assets/images/categories/burgers_trans.png"),
    query: "Burger",
    bgColor: "#FDEAEE",
  },
  {
    key: "pizza",
    label: "Pizza",
    image: require("@/assets/images/categories/pizza_trans.png"),
    query: "Pizza",
    bgColor: "#FDF1E5",
  },
  {
    key: "chinese",
    label: "Chinese",
    image: require("@/assets/images/categories/chinese_trans.png"),
    query: "Chinese",
    bgColor: "#FCF0F0",
  },
  {
    key: "south_indian",
    label: "South Indian",
    image: require("@/assets/images/categories/south_indian_trans.png"),
    query: "South Indian",
    bgColor: "#FEF0E7",
  },
  {
    key: "north_indian",
    label: "North Indian",
    image: require("@/assets/images/categories/north_indian_trans.png"),
    query: "North Indian",
    bgColor: "#FEEEDF",
  },
  {
    key: "healthy",
    label: "Healthy",
    image: require("@/assets/images/categories/healthy_trans.png"),
    query: "Healthy",
    bgColor: "#F4F5E5",
  },
  {
    key: "groceries",
    label: "Groceries",
    image: require("@/assets/images/categories/groceries_trans.png"),
    query: "Groceries",
    bgColor: "#EEF7E4",
  },
];

const MEALS_FOOD_ITEMS: FoodCategoryItem[] = [
  {
    key: "breakfast",
    label: "Breakfast",
    image: require("@/assets/images/categories/south_indian_trans.png"),
    query: "Breakfast",
    bgColor: "#FEF0E7",
  },
  {
    key: "lunch",
    label: "Lunch",
    image: require("@/assets/images/categories/north_indian_trans.png"),
    query: "Lunch",
    bgColor: "#FEEEDF",
  },
  {
    key: "snacks",
    label: "Snacks",
    image: require("@/assets/images/categories/burgers_trans.png"),
    query: "Snacks",
    bgColor: "#FDEAEE",
  },
  {
    key: "dinner",
    label: "Dinner",
    image: require("@/assets/images/categories/biryani_trans.png"),
    query: "Dinner",
    bgColor: "#FEECDE",
  },
  {
    key: "dessert",
    label: "Desserts",
    image: require("@/assets/images/categories/pizza_trans.png"),
    query: "Dessert",
    bgColor: "#FDF1E5",
  },
];

const OCCASIONS_FOOD_ITEMS: FoodCategoryItem[] = [
  {
    key: "party",
    label: "Party Orders",
    image: require("@/assets/images/categories/pizza_trans.png"),
    query: "Party",
    bgColor: "#FDF1E5",
  },
  {
    key: "family_feast",
    label: "Family Feast",
    image: require("@/assets/images/categories/biryani_trans.png"),
    query: "Family",
    bgColor: "#FEECDE",
  },
  {
    key: "late_night",
    label: "Late Night",
    image: require("@/assets/images/categories/burgers_trans.png"),
    query: "Late Night",
    bgColor: "#FDEAEE",
  },
  {
    key: "treats",
    label: "Sweet Treats",
    image: require("@/assets/images/categories/chinese_trans.png"),
    query: "Sweet",
    bgColor: "#FCF0F0",
  },
];

const VERTICAL_RAIL_CATEGORIES = [
  {
    key: "biryani",
    label: "Biryani",
    image: require("@/assets/images/rail/biryani_trans.png"),
    query: "Biryani",
  },
  {
    key: "dosa",
    label: "Dosa",
    image: require("@/assets/images/rail/dosa_trans.png"),
    query: "Dosa",
  },
  {
    key: "fried_rice",
    label: "Fried Rice",
    image: require("@/assets/images/rail/fried_rice_trans.png"),
    query: "Fried Rice",
  },
  {
    key: "cakes",
    label: "Cakes",
    image: require("@/assets/images/rail/cakes_trans.png"),
    query: "Cake",
  },
  {
    key: "burgers",
    label: "Burgers",
    image: require("@/assets/images/rail/burgers_trans.png"),
    query: "Burger",
  },
  {
    key: "pastry",
    label: "Pastry",
    image: require("@/assets/images/rail/pastry_trans.png"),
    query: "Pastry",
  },
  {
    key: "shakes",
    label: "Shakes",
    image: require("@/assets/images/rail/shakes_trans.png"),
    query: "Shake",
  },
  {
    key: "pizza",
    label: "Pizza",
    image: require("@/assets/images/rail/pizza_trans.png"),
    query: "Pizza",
  },
];

const FOOD_CATEGORY_FILTERS: FoodCategoryItem[] = [
  {
    key: "biryani",
    label: "Biryani",
    image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300&q=80",
    query: "Biryani",
    bgColor: "#FEECDE",
  },
  {
    key: "fried_rice",
    label: "Fried rice",
    image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=300&q=80",
    query: "Fried Rice",
    bgColor: "#FEECDE",
  },
  {
    key: "cakes",
    label: "Cakes",
    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=300&q=80",
    query: "Cake",
    bgColor: "#FEECDE",
  },
  {
    key: "burgers",
    label: "Burgers",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&q=80",
    query: "Burger",
    bgColor: "#FDEAEE",
  },
  {
    key: "pastry",
    label: "Pastry",
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&q=80",
    query: "Pastry",
    bgColor: "#FEECDE",
  },
  {
    key: "shake",
    label: "Shake",
    image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=300&q=80",
    query: "Shake",
    bgColor: "#FEECDE",
  },
  {
    key: "pizza",
    label: "Pizza",
    image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=300&q=80",
    query: "Pizza",
    bgColor: "#FDF1E5",
  },
  {
    key: "dosa",
    label: "Dosa",
    image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=300&q=80",
    query: "Dosa",
    bgColor: "#FEF0E7",
  },
  {
    key: "noodles",
    label: "Noodles",
    image: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=300&q=80",
    query: "Noodles",
    bgColor: "#FCF0F0",
  },
  {
    key: "rolls",
    label: "Rolls",
    image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=300&q=80",
    query: "Rolls",
    bgColor: "#FEECDE",
  },
  {
    key: "coffee",
    label: "Coffee",
    image: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=300&q=80",
    query: "Coffee",
    bgColor: "#FEECDE",
  },
  {
    key: "thali",
    label: "Thali",
    image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=300&q=80",
    query: "Thali",
    bgColor: "#FEEEDF",
  },
  {
    key: "dessert",
    label: "Dessert",
    image: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=300&q=80",
    query: "Dessert",
    bgColor: "#FEECDE",
  },
  {
    key: "icecream",
    label: "Ice Cream",
    image: "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=300&q=80",
    query: "Ice Cream",
    bgColor: "#FEECDE",
  },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const grads = tileGradient(colors);
  const { user } = useAuth();
  const homeScrollRef = useRef<any>(null);
  const { tabBarTranslateY, setPagerScrollEnabled, setIsBottomNavHidden, activeTabIndex } = useTabBarVisibility();

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

  // Ad banners carousel auto-scroll animation ref
  const adBannerScrollRef = useRef<any>(null);
  const [activeAdBannerIdx, setActiveAdBannerIdx] = useState(0);
  const [scrollTimestamp, setScrollTimestamp] = useState(0);
  const lastScrollTimestampRef = useRef(0);

  // Top category pill filter state
  const [activeCategoryPill, setActiveCategoryPill] = useState<string>("all");

  // Vertical side filter rail state & animations
  const [showVerticalRail, setShowVerticalRail] = useState(false);
  const [isRailCollapsed, setIsRailCollapsed] = useState(false);
  const [railSide, setRailSide] = useState<"right" | "left">("right");
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [activeMindPill, setActiveMindPill] = useState<string>("cuisines");
  const railCollapseAnim = useSharedValue(0); // 0: expanded, 1: collapsed
  const railProgress = useSharedValue(0); // 0: outside nearby, 1: inside nearby

  // Track position of "All shops nearby"
  const nearbySectionY = useRef<number>(9999);

  const [topHeaderHeight, setTopHeaderHeight] = useState(150);
  const headerHeightShared = useSharedValue(150);
  const [locRowHeight, setLocRowHeight] = useState(56);
  const collapseProgress = useSharedValue(0); // 0: fully expanded, 1: fully collapsed
  const stickyChipsProgress = useSharedValue(0); // 0: hidden behind search bar, 1: revealed below search bar
  const tilesSectionY = useRef<number>(240); // Track position of top options section

  // When navigating away from Home tab (activeTabIndex !== 0), automatically dismiss the vertical rail and reopen pill
  useEffect(() => {
    if (activeTabIndex !== 0) {
      setShowVerticalRail(false);
      railProgress.value = 0;
    }
  }, [activeTabIndex]);

  // Scroll tracking ref to compute delta
  const lastScrollY = useRef(0);
  const isHiddenRef = useRef(false);
  const accumulatedDiff = useRef(0);

  const TIMING_CONFIG = {
    duration: 300,
    easing: Easing.out(Easing.cubic),
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

    // Ignore microscopic noise (< 1px) or micro-trembles while holding finger
    if (Math.abs(diff) < 1) return;

    // Trigger cart message collapse on active scroll
    if (Math.abs(diff) > 20) {
      const now = Date.now();
      if (now - lastScrollTimestampRef.current > 600) {
        lastScrollTimestampRef.current = now;
        setScrollTimestamp(now);
      }
    }

    // Trigger vertical rail ONLY when scrolled into the "All shops nearby" card list
    const inNearby = currentY >= nearbySectionY.current + 20;
    if (inNearby) {
      if (!showVerticalRail) {
        setShowVerticalRail(true);
      }
      railProgress.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) });
    } else {
      if (railProgress.value > 0) {
        railProgress.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) }, (finished) => {
          if (finished) {
            runOnJS(setShowVerticalRail)(false);
          }
        });
      }
    }

    // Show sticky horizontal chips only when user scrolls down past the main top options grid (tiles section)
    const tilesBottom = tilesSectionY.current > 0 ? tilesSectionY.current : 220;
    if (currentY >= tilesBottom - 40) {
      if (stickyChipsProgress.value < 1) {
        stickyChipsProgress.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) });
      }
    } else {
      if (stickyChipsProgress.value > 0) {
        stickyChipsProgress.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) });
      }
    }

    // Only trigger when scrolled past top padding or pulled down
    if (currentY <= 15) {
      accumulatedDiff.current = 0;
      // At the very top, always show header and tab bar
      if (isHiddenRef.current) {
        isHiddenRef.current = false;
        collapseProgress.value = withTiming(0, TIMING_CONFIG);
        tabBarTranslateY.value = withTiming(0, TIMING_CONFIG);
        floatingSearchAnim.value = withTiming(0, TIMING_CONFIG);
      }
    } else {
      // Accumulate scroll displacement in consistent direction
      if ((diff > 0 && accumulatedDiff.current < 0) || (diff < 0 && accumulatedDiff.current > 0)) {
        accumulatedDiff.current = 0;
      }
      accumulatedDiff.current += diff;

      // Hysteresis threshold: requires intentional, sustained drag (>= 50px) before flipping
      if (accumulatedDiff.current > 50 && currentY > 80) {
        // User is intentionally scrolling content UP (finger moving up) -> hide top address & bottom tab bar
        if (!isHiddenRef.current) {
          isHiddenRef.current = true;
          collapseProgress.value = withTiming(1, TIMING_CONFIG);
          tabBarTranslateY.value = withTiming(100, TIMING_CONFIG);
          floatingSearchAnim.value = withTiming(1, TIMING_CONFIG);
        }
      } else if (accumulatedDiff.current < -50) {
        // User is intentionally scrolling content DOWN (finger moving down) -> reveal both smoothly
        if (isHiddenRef.current) {
          isHiddenRef.current = false;
          collapseProgress.value = withTiming(0, TIMING_CONFIG);
          tabBarTranslateY.value = withTiming(0, TIMING_CONFIG);
          floatingSearchAnim.value = withTiming(0, TIMING_CONFIG);
        }
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

  // Auto-scroll animation for advertisement cards carousel (only runs when Home tab is active)
  useEffect(() => {
    if (activeTabIndex !== 0) return;
    const timer = setInterval(() => {
      setActiveAdBannerIdx((prev) => {
        const next = (prev + 1) % AD_BANNERS.length;
        const bannerCardWidth = 300 + 12; // card width + gap
        adBannerScrollRef.current?.scrollTo({ x: next * bannerCardWidth, animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [activeTabIndex]);

  const locRowAnimStyle = useAnimatedStyle(() => {
    // Smoothly collapses the top brand and greeting row upwards
    // Using maxHeight + opacity gives clean layout recalculation without cutting into search bar
    return {
      maxHeight: interpolate(collapseProgress.value, [0, 1], [95, 0]),
      opacity: interpolate(collapseProgress.value, [0, 0.7, 1], [1, 0.2, 0]),
      overflow: "hidden",
    };
  });

  const stickyChipsAnimStyle = useAnimatedStyle(() => {
    return {
      maxHeight: interpolate(stickyChipsProgress.value, [0, 1], [0, 48]),
      opacity: stickyChipsProgress.value,
      transform: [
        { translateY: interpolate(stickyChipsProgress.value, [0, 1], [-38, 0]) },
      ],
      pointerEvents: stickyChipsProgress.value > 0.6 ? ("auto" as const) : ("none" as const),
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
    // 60fps UI-thread calculation: header top padding + search row (46) + sticky chips (up to 48) + top branding (interpolated 95 to 0)
    const headerTopPadding = insets.top + spacing.xs;
    const topRowH = interpolate(collapseProgress.value, [0, 1], [95, 0]);
    const searchH = 46 + 4; // search height + marginTop
    const chipsH = stickyChipsProgress.value * 48;
    const computedTop = headerTopPadding + topRowH + searchH + chipsH + 12;

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
  }, [railSide, bottomChrome, insets.bottom, insets.top]);

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
    // When rail is active, animate the side padding from 0 to 92 (86px rail width + 6px gap)
    const targetPadding = interpolate(activeOpen, [0, 1], [0, 92]);

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
      {/* Background Graphic matching supplied image */}
      <Image
        source={require("@/assets/images/gathr_home_bg.jpg")}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        priority="high"
      />

      {/* Sticky Top Header */}
      <View
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0) {
            setTopHeaderHeight(h);
            headerHeightShared.value = h;
          }
        }}
        style={[s.header, { paddingTop: insets.top + spacing.xs }]}
      >
        {/* Top Header Section: Logo + Greeting (smoothly collapsed without pushing search bar into negative margin) */}
        <Animated.View style={locRowAnimStyle}>
          {/* Top Header Row: Gathr Logo on left, Notification & Menu on right */}
          <View style={s.locRow}>
            {/* Official Gathr Logo on extreme left with "Gathr" brand text */}
            <Pressable
              onPress={() => router.push("/addresses")}
              style={s.brandHeaderLeft}
            >
              <Image
                source={require("@/assets/images/gathr_logo_tight.png")}
                style={s.brandLogoImg}
                contentFit="contain"
              />
              <Text style={s.brandNameText}>Gathr</Text>
            </Pressable>

            {/* Right Header Controls: Notification Bell + 3-line Menu Button */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              {/* Notification Button */}
              <Pressable
                testID="home-notifications-button"
                onPress={() => router.push("/notifications")}
                style={({ pressed }) => [
                  s.headerCircleBtn,
                  pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
                ]}
              >
                <BlurView
                  intensity={18}
                  tint="light"
                  style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                  colors={["rgba(255, 255, 255, 0.70)", "rgba(255, 230, 238, 0.40)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Ionicons name="notifications-outline" size={20} color="#475569" />
                {notif.data?.unread ? (
                  <View style={s.dot}>
                    <Text style={s.dotText}>{Math.min(notif.data.unread, 9)}</Text>
                  </View>
                ) : null}
              </Pressable>

              {/* Account Profile Button */}
              <Pressable
                testID="home-profile-menu-button"
                onPress={() => router.push("/account")}
                style={({ pressed }) => [
                  s.headerCircleBtn,
                  pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
                ]}
              >
                <BlurView
                  intensity={18}
                  tint="light"
                  style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                  colors={["rgba(255, 255, 255, 0.70)", "rgba(255, 230, 238, 0.40)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Ionicons name="person-outline" size={20} color="#475569" />
              </Pressable>
            </View>
          </View>

          {/* Greeting Text below logo: "Good evening, Rahul! 👋" and "What are you craving today?" */}
          <View style={{ paddingHorizontal: 2, paddingTop: 4, paddingBottom: 2 }}>
            <Text style={s.greetingTitle}>
              Good evening, {user?.name?.split(" ")[0] || "Rahul"}! 👋
            </Text>
            <Text style={s.greetingSubtitle}>
              What are you craving today?
            </Text>
          </View>
        </Animated.View>

        {/* Search bar row with Animated Placeholder, Mic, and Veg filter */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4, zIndex: 5 }}>
          <Pressable
            testID="home-search-bar"
            onPress={openSearchHighlight}
            style={[s.search, { flex: 1 }]}
          >
            {/* Backdrop blur layer for liquid glass */}
            <BlurView
              intensity={20}
              tint="light"
              style={StyleSheet.absoluteFill}
            />

            {/* Blush-pink liquid glass gradient tint */}
            <LinearGradient
              colors={[
                "rgba(255, 255, 255, 0.65)",
                "rgba(255, 228, 235, 0.35)",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            {/* Specular glass highlight reflection along top edge */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                left: 16,
                right: 16,
                height: 1,
                backgroundColor: "rgba(255, 255, 255, 0.85)",
              }}
            />

            <Ionicons name="search" size={17} color="#F43F5E" />
            <View style={{ flex: 1, height: 38, justifyContent: "center", position: "relative" }}>
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

            {/* Voice mic option */}
            <Pressable
              testID="home-voice-mic-button"
              onPress={(e) => {
                e.stopPropagation();
                setVoiceModalVisible(true);
              }}
              style={({ pressed }) => [
                { padding: 3, alignItems: "center", justifyContent: "center" },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="mic" size={19} color="#F43F5E" />
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

        {/* Collapsible Horizontal Options List: Appears when scrolled down past main options grid, tucks behind search */}
        <Animated.View style={[s.stickyChipsContainer, stickyChipsAnimStyle]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.categoryPillsScroll}
            keyboardShouldPersistTaps="handled"
          >
            {[
              { key: "all", label: "All" },
              { key: "food", label: "Food", href: "/listing/food" },
              { key: "groceries", label: "Groceries", href: "/groceries" },
              { key: "group", label: "Group", href: "/groups" },
              { key: "apartment", label: "Apartment", href: "/community" },
              { key: "bites", label: "Bites", href: "/reels" },
            ].map((pill) => {
              const isActive = activeCategoryPill === pill.key;
              return (
                <Pressable
                  key={`sticky-${pill.key}`}
                  testID={`sticky-cat-pill-${pill.key}`}
                  onPress={() => {
                    setActiveCategoryPill(pill.key);
                    if (pill.href) {
                      router.push(pill.href as any);
                    }
                  }}
                  style={({ pressed }) => [
                    s.categoryPill,
                    isActive ? s.categoryPillActive : s.categoryPillInactive,
                    pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                  ]}
                >
                  {!isActive && (
                    <>
                      <BlurView intensity={18} tint="light" style={StyleSheet.absoluteFill} />
                      <LinearGradient
                        colors={["rgba(255, 255, 255, 0.90)", "rgba(255, 241, 245, 0.65)"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                    </>
                  )}
                  <Text
                    style={[
                      s.categoryPillText,
                      isActive ? s.categoryPillTextActive : s.categoryPillTextInactive,
                    ]}
                  >
                    {pill.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
      </View>

      {/* Voice Search Modal */}
      <VoiceSearchModal
        visible={voiceModalVisible}
        onClose={() => setVoiceModalVisible(false)}
        onTranscript={(spoken) => {
          router.push(`/search?q=${encodeURIComponent(spoken)}${vegOnly ? "&veg=1" : ""}`);
        }}
      />

      {q.isLoading ? (
        <HomeSkeleton />
      ) : q.isError ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
      ) : (
        <ScrollView
          ref={homeScrollRef}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: bottomChrome + 80 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); notif.refetch(); }} tintColor={colors.brandPrimary} />}
        >
          {/* 1. Hero Food & Cloud Kitchens Banner matching Reference */}
          <View style={s.heroCardV3}>
            {/* Background Image: Biryani bowl photography on dark table */}
            <Image
              source={
                q.data?.home_banner?.image_url && !q.data.home_banner.image_url.startsWith("/assets")
                  ? { uri: mediaUri(q.data.home_banner.image_url) }
                  : require("@/assets/images/home_v2/hero_banner.jpg")
              }
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
            />

            {/* Left banner content */}
            <View style={s.heroTextColV3}>
              {/* Eyebrow: GOOD FOOD, GOOD MOOD with underline */}
              <View style={s.heroEyebrowWrapV3}>
                <Text style={s.heroEyebrowTextV3}>GOOD FOOD, GOOD MOOD</Text>
                <View style={s.heroEyebrowLineV3} />
              </View>

              <Text style={s.heroTitleCravingsV3}>
                Cravings?{"\n"}
                <Text style={s.heroTitleWeGotYouV3}>We've got you!</Text>
              </Text>

              {/* Order Now Pill Button */}
              <Pressable
                testID="hero-order-now-btn"
                onPress={() => router.push("/listing/food")}
                style={({ pressed }) => [
                  s.heroOrderNowBtn,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.96 }] },
                ]}
              >
                <Text style={s.heroOrderNowText}>Order Now</Text>
                <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          {/* 2. Four Quick Shortcut Cards Matching Reference Screenshot */}
          <View style={s.fourShortcutsGrid}>
            {[
              {
                key: "discover",
                title: "Discover",
                sub: "Restaurants",
                icon: "compass-outline" as const,
                href: "/listing/new",
              },
              {
                key: "group",
                title: "Group",
                sub: "Orders",
                icon: "people-outline" as const,
                href: "/groups",
              },
              {
                key: "community",
                title: "Apartments",
                sub: "& Communities",
                icon: "business-outline" as const,
                href: "/community",
              },
              {
                key: "bites",
                title: "Bites",
                sub: "& Reels",
                icon: "play-circle-outline" as const,
                href: "/reels",
              },
            ].map((item) => (
              <Pressable
                key={item.key}
                testID={`home-shortcut-${item.key}`}
                onPress={() => {
                  if (item.href) router.push(item.href as any);
                }}
                style={({ pressed }) => [
                  s.shortcutCard,
                  pressed && { opacity: 0.88, transform: [{ scale: 0.96 }] },
                ]}
              >
                <BlurView intensity={24} tint="light" style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={["rgba(255, 241, 245, 0.90)", "rgba(255, 222, 233, 0.65)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={s.shortcutIconWrap}>
                  <Ionicons name={item.icon} size={22} color="#F43F5E" />
                </View>
                <Text style={s.shortcutTitle}>{item.title}</Text>
                <Text style={s.shortcutSub}>{item.sub}</Text>
              </Pressable>
            ))}
          </View>

          {/* 3. Schedule for later Banner - STRICTLY PRESERVED UNCHANGED */}
          <Pressable
            testID="home-schedule-entry"
            onPress={() => router.push("/listing/food?schedule=1")}
            style={s.lightScheduleBannerV3}
          >
            {/* Background image with faint planner/leaves illustration on right */}
            <Image
              source={require("@/assets/images/home_v2/schedule_banner_light.png")}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />

            {/* Left Calendar Icon Box */}
            <View style={s.lightScheduleIconBoxV3}>
              <Ionicons name="calendar-outline" size={24} color="#1E3A2F" />
            </View>

            {/* Middle Vertical Separator Line */}
            <View style={s.lightScheduleDividerV3} />

            {/* Text description */}
            <View style={s.lightScheduleTextColV3}>
              <Text style={s.lightScheduleTitleV3}>Schedule for later</Text>
              <Text style={s.lightScheduleSubV3} numberOfLines={2}>
                Plan meals, groceries or group orders ahead of time
              </Text>
            </View>

            {/* Dark green pill button */}
            <View style={s.lightScheduleBtnV3}>
              <Text style={s.lightScheduleBtnTextV3}>Schedule Order</Text>
              <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
            </View>
          </Pressable>

          {/* Veg mode banner with 'Change >' (only shown when veg mode is on) */}
          {vegOnly ? (
            <View style={s.modernVegBanner}>
              {/* Liquid frosted glass layer */}
              <BlurView
                intensity={28}
                tint="light"
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={["rgba(255, 255, 255, 0.90)", "rgba(240, 253, 244, 0.75)", "rgba(255, 241, 242, 0.55)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              {/* Top glass reflection highlight */}
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 14,
                  right: 14,
                  height: 1,
                  backgroundColor: "rgba(255, 255, 255, 0.85)",
                }}
              />

              <View style={s.modernVegBannerLeft}>
                <View style={s.modernVegLeafCircle}>
                  <Ionicons name="leaf" size={13} color="#15803D" />
                </View>
                <Text style={s.modernVegBannerBold}>Veg mode on</Text>
                <Text style={s.modernVegBannerBullet}>•</Text>
                <Text style={s.modernVegBannerText} numberOfLines={1}>
                  Showing veg options only
                </Text>
              </View>

              <Pressable
                onPress={() => setVegOnly(false)}
                style={({ pressed }) => [
                  s.modernVegChangeBtn,
                  pressed && { opacity: 0.75, transform: [{ scale: 0.97 }] },
                ]}
                hitSlop={8}
              >
                <Text style={s.modernVegChangeText}>Turn off</Text>
                <Ionicons name="close-circle-outline" size={14} color="#15803D" />
              </Pressable>
            </View>
          ) : null}

          {/* 4. Trending near you Section */}
          <SectionTitle
            title="Trending near you"
            subtitle="Most loved shops in your area"
            icon="flame"
            iconBg="#FCE7F3"
            iconColor="#F43F5E"
            action="See all"
            testID="home-trending-see-all"
            onAction={() => router.push("/listing/food")}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            onTouchStart={() => setPagerScrollEnabled(false)}
            onTouchEnd={() => setPagerScrollEnabled(true)}
            onScrollBeginDrag={() => setPagerScrollEnabled(false)}
            onScrollEndDrag={() => setPagerScrollEnabled(true)}
            onMomentumScrollEnd={() => setPagerScrollEnabled(true)}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 12, paddingBottom: 10 }}
          >
            {q.data!.trending.map((sl, i) => (
              <SellerTile key={sl.id} s={sl} rank={i + 1} testID={`home-trending-${sl.id}`} />
            ))}
          </ScrollView>

          {/* 6. Newly opened Section */}
          <SectionTitle
            title="Newly opened"
            subtitle="Fresh listings added in your area"
            icon="storefront"
            iconBg="#FCE7F3"
            iconColor="#F43F5E"
            action="See all"
            testID="home-new-see-all"
            onAction={() => router.push("/listing/new")}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            onTouchStart={() => setPagerScrollEnabled(false)}
            onTouchEnd={() => setPagerScrollEnabled(true)}
            onScrollBeginDrag={() => setPagerScrollEnabled(false)}
            onScrollEndDrag={() => setPagerScrollEnabled(true)}
            onMomentumScrollEnd={() => setPagerScrollEnabled(true)}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 12, paddingBottom: 4 }}
          >
            {q.data!.new_shops.map((sl) => (
              <SellerTile key={sl.id} s={sl} isNew testID={`home-new-${sl.id}`} />
            ))}
          </ScrollView>

          {/* 5. Offers for you Section Header & Redesigned Cards (Commented out for now) */}
          {/*
          <SectionTitle
            title="Offers for you"
            icon="pricetag"
            iconBg="#DCFCE7"
            action="View all offers"
            testID="home-view-all-offers"
            onAction={() => router.push("/offers" as any)}
          />
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
            <Pressable
              onPress={() => router.push("/offers" as any)}
              style={[s.nativeOfferCard, { backgroundColor: "#FFF8F2", borderColor: "#FFEDD5" }]}
            >
              <Image
                source={require("@/assets/images/home_v2/illus_offer_bag.png")}
                style={s.offerBagIllus}
                contentFit="contain"
              />
              <View style={s.nativeOfferContent}>
                <View style={s.nativeOfferBadge}>
                  <Text style={s.nativeOfferBadgeText}>GATHR50</Text>
                </View>
                <Text style={s.nativeOfferAmount}>₹50 OFF</Text>
                <Text style={s.nativeOfferCondition}>on orders above ₹299</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => router.push("/offers" as any)}
              style={[s.nativeOfferCard, { backgroundColor: "#F2FBF6", borderColor: "#DCFCE7" }]}
            >
              <Image
                source={require("@/assets/images/home_v2/illus_offer_bowl.png")}
                style={s.offerBowlIllus}
                contentFit="contain"
              />
              <View style={s.nativeOfferContent}>
                <View style={[s.nativeOfferBadge, { backgroundColor: "#DCFCE7" }]}>
                  <Text style={[s.nativeOfferBadgeText, { color: "#15803D" }]}>ROOMIES20</Text>
                </View>
                <Text style={s.nativeOfferAmount}>20% OFF</Text>
                <Text style={s.nativeOfferCondition}>on orders above ₹399,{"\n"}up to ₹120</Text>
              </View>
            </Pressable>

            {q.data!.offers
              .filter((o) => o.code !== "GATHR50" && o.code !== "ROOMIES20")
              .map((o, i) => (
                <View
                  key={o.code}
                  testID={`home-offer-${o.code}`}
                  style={[s.modernOfferCard, { backgroundColor: i % 2 === 0 ? "#FAF5FF" : "#F0F9FF", borderColor: i % 2 === 0 ? "#E9D5FF" : "#BAE6FD" }]}
                >
                  <View style={s.modernOfferLeft}>
                    <View style={[s.modernOfferTicketIcon, { backgroundColor: i % 2 === 0 ? "#9333EA" : "#0284C7" }]}>
                      <Text style={s.modernOfferTicketSymbol}>%</Text>
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={s.modernOfferCodeText}>{o.code}</Text>
                      <Text style={s.modernOfferSubText}>{o.description}</Text>
                    </View>
                  </View>
                </View>
              ))}
          </ScrollView>
          */}

          <Pressable testID="home-community-banner" onPress={() => router.push("/community")} style={s.communityCard}>
            {/* Subtle community watercolor illustration overlay */}
            <Image
              source={require("@/assets/images/home_v2/schedule_banner_light.png")}
              style={[StyleSheet.absoluteFill, { opacity: 0.12, transform: [{ scaleX: -1 }] }]}
              contentFit="cover"
            />
            {/* Soft sky-tinted liquid background */}
            <LinearGradient
              colors={["#F0F7FD", "#E2F0FC"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            {/* Left Building Icon Box */}
            <View style={s.communityIconBox}>
              <Ionicons name="business-outline" size={24} color="#0369A1" />
            </View>

            {/* Middle Vertical Separator Line */}
            <View style={s.communityDivider} />

            {/* Middle Description */}
            <View style={s.communityTextCol}>
              <Text style={s.communityTitle}>Apartment Community</Text>
              <Text style={s.communitySub} numberOfLines={2}>
                Order together, separate bill & package per flat
              </Text>
            </View>

            {/* Right Action Pill Button */}
            <View style={s.communityBtn}>
              <Text style={s.communityBtnText}>Join Basket</Text>
              <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
            </View>
          </Pressable>

          {/* Advertisement Banners Carousel with Auto-Scroll Animation (Moved in place of What's on your mind) */}
          <ScrollView
            ref={adBannerScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            onTouchStart={() => setPagerScrollEnabled(false)}
            onTouchEnd={() => setPagerScrollEnabled(true)}
            onScrollBeginDrag={() => setPagerScrollEnabled(false)}
            onScrollEndDrag={() => setPagerScrollEnabled(true)}
            onMomentumScrollEnd={(e) => {
              setPagerScrollEnabled(true);
              const x = e.nativeEvent.contentOffset.x;
              const w = 300 + 12;
              if (w > 0) setActiveAdBannerIdx(Math.round(x / w));
            }}
            contentContainerStyle={s.adBannersScrollContent}
            style={{ marginTop: 14, marginBottom: 12 }}
          >
            {AD_BANNERS.map((banner, idx) => (
              <Pressable
                key={banner.key}
                testID={`home-ad-banner-${banner.key}`}
                onPress={() => router.push(banner.href as any)}
                style={s.adBannerCard}
              >
                <Image
                  source={{ uri: banner.image }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={200}
                />
                <LinearGradient
                  colors={banner.gradColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.bannerInner}
                >
                  <Text style={s.bannerTitle}>{banner.title}</Text>
                  <View style={s.bannerCta}>
                    <Text style={s.bannerCtaText}>{banner.cta}</Text>
                    <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
                  </View>
                </LinearGradient>
              </Pressable>
            ))}
          </ScrollView>

          {/* Horizontal "What's on your mind?" Section (Commented out for now) */}
          {/*
          <View style={s.mindSectionContainer}>
            <View style={s.mindHeaderRow}>
              <View style={s.mindHeaderIconWrap}>
                <Image
                  source={require("@/assets/images/categories/fork_spoon_icon.png")}
                  style={s.mindForkSpoonIcon}
                  contentFit="contain"
                />
              </View>
              <View style={s.mindHeaderTitles}>
                <Text style={s.mindHeaderTitle}>What's on your mind?</Text>
                <Text style={s.mindHeaderSubtitle}>Explore by cuisine, meal or need</Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled
              contentContainerStyle={s.mindPillsScrollContent}
              style={{ marginTop: 12, overflow: "visible" }}
            >
              {WHAT_ON_MIND_PILLS.map((pill) => {
                const isActive = activeMindPill === pill.key;
                return (
                  <Pressable
                    key={pill.key}
                    testID={`mind-pill-${pill.key}`}
                    onPress={() => {
                      if (pill.key === "nearby") {
                        if (nearbySectionY.current > 0) {
                          homeScrollRef.current?.scrollTo({ y: Math.max(0, nearbySectionY.current - 100), animated: true });
                        }
                      } else if (pill.key === "more") {
                      } else {
                        setActiveMindPill(pill.key);
                      }
                    }}
                    style={({ pressed }) => [
                      s.mindPill,
                      isActive && s.mindPillActive,
                      pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] },
                    ]}
                  >
                    {pill.icon === "cuisines" ? (
                      <Image
                        source={require("@/assets/images/categories/cuisines_icon.png")}
                        style={[s.mindPillIconImg, { tintColor: isActive ? "#FFFFFF" : "#1F2937" }]}
                        contentFit="contain"
                      />
                    ) : pill.icon === "meals" ? (
                      <Image
                        source={require("@/assets/images/categories/meals_icon.png")}
                        style={[s.mindPillIconImg, { tintColor: isActive ? "#FFFFFF" : "#1F2937" }]}
                        contentFit="contain"
                      />
                    ) : (
                      <Ionicons
                        name={pill.icon as any}
                        size={17}
                        color={isActive ? "#FFFFFF" : "#1F2937"}
                      />
                    )}
                    <Text style={[s.mindPillText, isActive && s.mindPillTextActive]}>
                      {pill.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={{ marginTop: 16 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled
                onTouchStart={() => setPagerScrollEnabled(false)}
                onTouchEnd={() => setPagerScrollEnabled(true)}
                onScrollBeginDrag={() => setPagerScrollEnabled(false)}
                onScrollEndDrag={() => setPagerScrollEnabled(true)}
                onMomentumScrollEnd={() => setPagerScrollEnabled(true)}
                contentContainerStyle={s.mindCardsScrollContent}
              >
                {(activeMindPill === "meals"
                  ? MEALS_FOOD_ITEMS
                  : activeMindPill === "occasions"
                  ? OCCASIONS_FOOD_ITEMS
                  : CUISINES_FOOD_ITEMS
                ).map((cat) => {
                  const isSelected = selectedFilter === cat.key;
                  return (
                    <Pressable
                      key={cat.key}
                      testID={`home-food-filter-${cat.key}`}
                      onPress={() => handleFilterSelect(cat)}
                      style={({ pressed }) => [
                        s.mindFoodCardWrap,
                        pressed && { transform: [{ scale: 0.94 }] },
                      ]}
                    >
                      <View
                        style={[
                          s.mindFoodCardBox,
                          isSelected && s.mindFoodCardBoxSelected,
                        ]}
                      >
                        <Image
                          source={cat.image}
                          style={s.mindFoodCardImg}
                          contentFit="contain"
                          transition={150}
                        />
                      </View>
                      <Text
                        style={[
                          s.mindFoodCardLabel,
                          isSelected && s.mindFoodCardLabelSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {cat.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
          */}

          <SectionTitle
            title="Recommended for you"
            subtitle="Curated picks based on your taste"
            icon="thumbs-up"
            iconBg="#FCE7F3"
            iconColor="#F43F5E"
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            onTouchStart={() => setPagerScrollEnabled(false)}
            onTouchEnd={() => setPagerScrollEnabled(true)}
            onScrollBeginDrag={() => setPagerScrollEnabled(false)}
            onScrollEndDrag={() => setPagerScrollEnabled(true)}
            onMomentumScrollEnd={() => setPagerScrollEnabled(true)}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 12, paddingBottom: 4 }}
          >
            {q.data!.recommended.map((sl) => <SellerTile key={sl.id} s={sl} testID={`home-rec-${sl.id}`} />)}
          </ScrollView>

          <View
            onLayout={(e) => {
              nearbySectionY.current = e.nativeEvent.layout.y;
            }}
          >
            <SectionTitle
              title="All shops nearby"
              subtitle="Discover restaurants and stores around you"
              icon="location"
              iconBg="#FCE7F3"
              iconColor="#F43F5E"
            />
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
            <BrandFooter />
          </Animated.View>
        </ScrollView>
      )}

      {/* Floating Vertical Food Category Rail (shows only on Home tab when in "All shops nearby" section) */}
      {showVerticalRail && activeTabIndex === 0 && (
        <Animated.View
          style={[
            s.verticalRailWrapper,
            railSide === "left" ? s.railLeftWrapper : s.railRightWrapper,
            verticalRailAnimStyle,
          ]}
        >
          {/* Main vertical rail card matching screenshot design */}
          <View style={s.verticalRailCard}>
            <BlurView intensity={24} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={["rgba(255, 255, 255, 0.78)", "rgba(255, 235, 242, 0.45)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* 1. TOP: Left / Right place adjustment button */}
            <Pressable
              testID="rail-switch-side-button"
              onPress={toggleRailSide}
              hitSlop={8}
              style={({ pressed }) => [
                s.railSideAdjustCard,
                pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
              ]}
            >
              <Ionicons
                name={railSide === "right" ? "arrow-back" : "arrow-forward"}
                size={14}
                color="#374151"
              />
              <Text style={s.railSideAdjustText}>
                {railSide === "right" ? "Left" : "Right"}
              </Text>
            </Pressable>

            {/* Scrollable Items Container */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              contentContainerStyle={s.verticalRailScroll}
            >
              {/* 2. "All" item with light green background and dark green indicator bar */}
              <Pressable
                testID="rail-filter-all"
                onPress={() => setSelectedFilter(null)}
                style={({ pressed }) => [
                  s.railItemBox,
                  selectedFilter === null ? s.railItemAllActive : s.railItemInactive,
                  pressed && { transform: [{ scale: 0.95 }] },
                ]}
              >
                {selectedFilter === null && (
                  <View
                    style={[
                      s.railActiveIndicatorBar,
                      railSide === "right" ? { left: 0 } : { right: 0 },
                    ]}
                  />
                )}
                <Ionicons
                  name="grid-outline"
                  size={20}
                  color={selectedFilter === null ? "#166534" : "#4B5563"}
                />
                <Text
                  style={[
                    s.railItemLabel,
                    selectedFilter === null ? s.railItemAllLabelActive : s.railItemLabelInactive,
                  ]}
                  numberOfLines={1}
                >
                  All
                </Text>
              </Pressable>

              {/* 3. Food Category Items */}
              {VERTICAL_RAIL_CATEGORIES.map((cat) => {
                const isSelected = selectedFilter === cat.key;
                return (
                  <Pressable
                    key={cat.key}
                    testID={`rail-filter-${cat.key}`}
                    onPress={() => {
                      if (selectedFilter === cat.key) {
                        setSelectedFilter(null);
                      } else {
                        setSelectedFilter(cat.key);
                        router.push(`/search?q=${encodeURIComponent(cat.query)}${vegOnly ? "&veg=1" : ""}`);
                      }
                    }}
                    style={({ pressed }) => [
                      s.railItemBox,
                      isSelected ? s.railItemBoxSelected : s.railItemInactive,
                      pressed && { transform: [{ scale: 0.95 }] },
                    ]}
                  >
                    {isSelected && (
                      <View
                        style={[
                          s.railActiveIndicatorBar,
                          { backgroundColor: "#F43F5E" },
                          railSide === "right" ? { left: 0 } : { right: 0 },
                        ]}
                      />
                    )}
                    <Image
                      source={cat.image}
                      style={s.railFoodIconImg}
                      contentFit="contain"
                      transition={150}
                    />
                    <Text
                      style={[
                        s.railItemLabel,
                        isSelected ? s.railItemLabelSelected : s.railItemLabelInactive,
                      ]}
                      numberOfLines={1}
                    >
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* 4. Separate Fixed Bottom Card with chevron arrow and "Close" text */}
          <Pressable
            testID="rail-toggle-bottom-button"
            onPress={toggleRailCollapse}
            hitSlop={10}
            style={({ pressed }) => [
              s.railCloseCard,
              pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] },
            ]}
          >
            <BlurView intensity={24} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={["rgba(255, 255, 255, 0.78)", "rgba(255, 235, 242, 0.40)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons
              name={railSide === "right" ? "chevron-forward" : "chevron-back"}
              size={15}
              color={colors.onSurface}
            />
            <Text style={s.railCloseText}>Close</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Floating Reopen Button at screen edge when collapsed (only on Home tab) */}
      {showVerticalRail && activeTabIndex === 0 && (
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

      {/* Floating Collapsible Cart Status Bar on Home (docks opposite to the vertical filter rail) */}
      <FloatingCartBar
        bottomOffset={insets.bottom > 0 ? insets.bottom + 52 : 60}
        dockSide={railSide === "right" ? "left" : "right"}
        scrollActivityTimestamp={scrollTimestamp}
      />

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
          <Ionicons name="search" size={13} color="rgba(255,255,255,0.9)" />
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
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: "transparent",
    gap: spacing.xs,
    borderBottomWidth: 0,
    overflow: "hidden",
    zIndex: 100,
  },
  locRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  brandHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandLogoImg: {
    width: 32,
    height: 44,
  },
  brandNameText: {
    fontSize: 27,
    fontWeight: "900",
    color: "#E11D48", // Theme crimson/rose matching Gathr logo
    letterSpacing: -0.5,
    includeFontPadding: false,
    lineHeight: 32,
    marginTop: 6,
  },
  headerCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 999, // perfectly round on all platforms
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.2,
    borderColor: "rgba(0, 0, 0, 0.08)",
  },
  menuIconWrap: {
    width: 18,
    height: 12,
    justifyContent: "space-between",
    alignItems: "center",
  },
  menuLine: {
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#1E293B",
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.4,
  },
  greetingSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#475569",
    marginTop: 2,
    letterSpacing: -0.1,
  },
  dot: {
    position: "absolute",
    top: 5,
    right: 5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#F43F5E",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  dotText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  search: {
    height: 46,
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.85)",
    overflow: "hidden",
    position: "relative",
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: 16,
    shadowColor: "#F43F5E",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  searchText: { color: c.muted, fontSize: font.base + 1 },

  /* Hero Banner V3 Matching Reference Screenshot */
  heroCardV3: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
    height: 170,
    borderRadius: 18,
    overflow: "hidden",
    position: "relative",
    paddingLeft: 20,
    paddingRight: 14,
    paddingVertical: 18,
    justifyContent: "center",
    backgroundColor: "#181411",
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  heroTextColV3: {
    maxWidth: "68%",
    zIndex: 2,
    gap: 4,
  },
  heroEyebrowWrapV3: {
    alignSelf: "flex-start",
    marginBottom: 2,
  },
  heroEyebrowTextV3: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#e93a60c5",
    letterSpacing: 1.2,
  },
  heroEyebrowLineV3: {
    height: 1,
    backgroundColor: "rgba(225, 29, 71, 0.22)",
    marginTop: 2,
    width: 100,
  },
  heroTitleCravingsV3: {
    fontSize: 32,
    lineHeight: 37,
    fontWeight: "900",
    color: "#ebe7e9ff",
    letterSpacing: -0.5,
  },
  heroTitleWeGotYouV3: {
    fontSize: 35,
    lineHeight: 37,
    fontWeight: "900",
    color: "#e93a60ff",
    letterSpacing: -0.5,
  },
  heroOrderNowBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#E11D48",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginTop: 8,
    shadowColor: "#E11D48",
    shadowOpacity: 0.35,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  heroOrderNowText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "800",
  },
  heroCarouselDots: {
    position: "absolute",
    bottom: 14,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    zIndex: 2,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
  heroDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F43F5E",
  },

  /* Four Shortcuts Grid Matching Reference Screenshot */
  fourShortcutsGrid: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: 10,
    marginTop: 16,
  },
  shortcutCard: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.2,
    borderColor: "rgba(255, 225, 233, 0.95)",
    overflow: "hidden",
    position: "relative",
    shadowColor: "#F43F5E",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  shortcutIconWrap: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  shortcutTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    letterSpacing: -0.2,
  },
  shortcutSub: {
    fontSize: 10,
    fontWeight: "500",
    color: "#64748B",
    textAlign: "center",
    marginTop: 1,
  },

  // Sticky Horizontal Quick Access Chips in Header
  stickyChipsContainer: {
    overflow: "hidden",
    marginTop: 2,
    marginHorizontal: -spacing.lg,
    zIndex: 1,
  },
  stickyChipsScroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: 4,
    paddingBottom: 2,
    gap: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
  },
  stickyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  stickyChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
    letterSpacing: -0.1,
  },

  hello: { fontSize: font.xl, fontWeight: "800", color: c.onSurface, paddingHorizontal: spacing.lg, marginTop: spacing.lg, letterSpacing: -0.3 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.md, marginTop: spacing.sm },
  tileWrap: { width: "33.33%", padding: spacing.xs },



  /* 2. Category Pills Strip */
  categoryPillsScroll: {
    paddingHorizontal: spacing.lg,
    gap: 8,
    alignItems: "center",
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.8)",
    overflow: "hidden",
    position: "relative",
    shadowColor: "#F43F5E",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1.5 },
  },
  categoryPillActive: {
    backgroundColor: "#F43F5E",
    borderColor: "#F43F5E",
    shadowColor: "#F43F5E",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  categoryPillInactive: {
    backgroundColor: "transparent",
  },
  categoryPillText: {
    fontSize: 12.5,
    letterSpacing: -0.1,
  },
  categoryPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  categoryPillTextInactive: {
    color: "#334155",
    fontWeight: "700",
  },

  /* 3. Section Grid (2 Big Cards + 4 Bottom Cards) */
  featureGridV3: {
    paddingHorizontal: spacing.lg,
    marginTop: 14,
    gap: 12,
  },
  topCardsRowV3: {
    flexDirection: "row",
    gap: 12,
  },
  bigFeatureCardV3: {
    flex: 1,
    height: 124,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    padding: 14,
    justifyContent: "flex-end",
    backgroundColor: "#1C1917",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1.5,
  },
  bigCardContentV3: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    zIndex: 2,
  },
  bigCardTextColV3: {
    gap: 2,
    flex: 1,
    paddingRight: 6,
  },
  bigCardTitleV3: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  bigCardSubV3: {
    fontSize: 10.5,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.75)",
  },
  bigCardArrowCircleV3: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },

  bottomFourGridV3: {
    flexDirection: "row",
    gap: 10,
  },
  fourCardColV3: {
    flex: 1,
  },
  fourCardV3: {
    backgroundColor: "#F8F8F7", // Warm soft grey background matching reference screenshot
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    height: 98,
    borderWidth: 1,
    borderColor: "#EFEFEA",
  },
  fourCardIconBoxV3: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  fourCardTextColV3: {
    alignItems: "center",
    gap: 2,
  },
  fourCardTitleV3: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    letterSpacing: -0.2,
    lineHeight: 14,
  },
  fourCardSubV3: {
    fontSize: 9,
    fontWeight: "500",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 11,
  },

  /* 4. Schedule for later Banner V3 */
  lightScheduleBannerV3: {
    marginHorizontal: spacing.lg,
    marginTop: 14,
    height: 72,
    borderRadius: 14,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    position: "relative",
    backgroundColor: "#F2F5F0",
    borderWidth: 1,
    borderColor: "#E3EAE0",
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  lightScheduleIconBoxV3: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  lightScheduleDividerV3: {
    width: 1,
    height: 32,
    backgroundColor: "#CBD5E1",
    zIndex: 2,
  },
  lightScheduleTextColV3: {
    flex: 1,
    gap: 2,
    zIndex: 2,
  },
  lightScheduleTitleV3: {
    color: "#0F172A",
    fontSize: 13.5,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  lightScheduleSubV3: {
    color: "#64748B",
    fontSize: 10.5,
    fontWeight: "500",
    lineHeight: 13,
  },
  lightScheduleBtnV3: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#1E3A2F", // Dark forest green matching reference screenshot button
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    zIndex: 2,
  },
  lightScheduleBtnTextV3: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },

  /* Native Offer Cards */
  nativeOfferCard: {
    width: 175,
    height: 100,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    padding: 12,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.015,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 0.8,
  },
  offerBagIllus: {
    position: "absolute",
    right: 0,
    bottom: 0,
    top: 0,
    width: 78,
  },
  offerBowlIllus: {
    position: "absolute",
    right: 0,
    bottom: 0,
    top: 0,
    width: 78,
  },
  nativeOfferContent: {
    gap: 2,
    maxWidth: "60%",
    zIndex: 2,
  },
  nativeOfferBadge: {
    backgroundColor: "#FFEDD5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  nativeOfferBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#C2410C",
    letterSpacing: 0.3,
  },
  nativeOfferAmount: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.4,
    marginTop: 2,
  },
  nativeOfferCondition: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
    lineHeight: 13,
  },

  /* 4. Modern Veg Banner */
  modernVegBanner: {
    marginHorizontal: spacing.lg,
    marginTop: 14,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.25)",
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#15803D",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1.5 },
    elevation: 1,
  },
  modernVegBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flex: 1,
  },
  modernVegLeafCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  modernVegBannerBold: {
    color: "#15803D",
    fontSize: 12.5,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  modernVegBannerBullet: {
    color: "rgba(21, 128, 61, 0.4)",
    fontSize: 12,
    marginHorizontal: 1,
  },
  modernVegBannerText: {
    color: "#475569",
    fontSize: 11.5,
    fontWeight: "500",
    flex: 1,
  },
  modernVegChangeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.22)",
  },
  modernVegChangeText: {
    color: "#15803D",
    fontSize: 11.5,
    fontWeight: "700",
  },

  /* 5. Modern Offer Cards */
  modernOfferCard: {
    minWidth: 175,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1.5,
  },
  modernOfferLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  modernOfferTicketIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modernOfferTicketSymbol: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },
  modernOfferCodeText: {
    color: "#0F172A",
    fontWeight: "900",
    fontSize: 13.5,
    letterSpacing: 0.2,
  },
  modernOfferSubText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 14,
  },

  /* Advertisement Cards Carousel */
  adBannersScrollContent: {
    paddingHorizontal: spacing.lg,
    gap: 12,
  },
  adBannerCard: {
    width: 300,
    height: 145,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: c.surfaceTertiary,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  bannerInner: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: "space-between",
  },
  bannerTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  bannerCta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: c.brandPrimary,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  bannerCtaText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },
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
    shadowColor: "#F43F5E",
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
    shadowColor: "#F43F5E",
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
  schedule: {
    marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border,
    flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface
  },
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
    shadowColor: "#F43F5E",
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
    marginTop: 14,
    height: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D5E7F7",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#F0F7FD",
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  communityIconBox: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  communityDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#CBD5E1",
    zIndex: 2,
  },
  communityTextCol: {
    flex: 1,
    gap: 2,
    zIndex: 2,
  },
  communityTitle: {
    fontWeight: "800",
    color: "#0F172A",
    fontSize: 13.5,
    letterSpacing: -0.2,
  },
  communitySub: {
    color: "#64748B",
    fontSize: 10.5,
    fontWeight: "500",
    lineHeight: 13,
  },
  communityBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#0369A1", // Ocean blue theme complementary to Schedule Order's dark green
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    zIndex: 2,
  },
  communityBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
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
    shadowColor: "#F43F5E",
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

  // Floating bottom search button
  floatingSearchContainer: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 99,
  },
  floatingSearchPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(35, 38, 42, 0.55)",
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    gap: 5,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  floatingSearchText: {
    color: "#FFFFFF",
    fontSize: 12.5,
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

  // "What's on your mind?" horizontal section styles matching reference image
  mindSectionContainer: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    overflow: "visible",
  },
  mindHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    gap: 10,
  },
  mindHeaderIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  mindForkSpoonIcon: {
    width: 22,
    height: 24,
  },
  mindHeaderTitles: {
    flex: 1,
  },
  mindHeaderTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  mindHeaderSubtitle: {
    fontSize: 12.5,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 2,
  },
  mindPillsScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 8,
    alignItems: "center",
  },
  mindPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  mindPillActive: {
    backgroundColor: "#F43F5E",
    borderColor: "#F43F5E",
    shadowColor: "#F43F5E",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  mindPillIconImg: {
    width: 17,
    height: 17,
  },
  mindPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  mindPillTextActive: {
    color: "#FFFFFF",
  },
  mindCardsScrollContent: {
    paddingHorizontal: spacing.lg,
    gap: 12,
  },
  mindFoodCardWrap: {
    alignItems: "center",
    width: 78,
  },
  mindFoodCardBox: {
    width: 76,
    height: 76,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  mindFoodCardBoxSelected: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1.5,
    borderColor: "#FFEDD5",
    transform: [{ scale: 1.04 }],
  },
  mindFoodCardImg: {
    width: 66,
    height: 56,
  },
  mindFoodCardLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "#1E293B",
    textAlign: "center",
  },
  mindFoodCardLabelSelected: {
    color: "#F43F5E",
    fontWeight: "800",
  },

  // Horizontal Food Filter Carousel (used by vertical rail fallback)
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

  // Floating Vertical Rail styles matching reference screenshot
  verticalRailWrapper: {
    position: "absolute",
    zIndex: 90,
    gap: 8,
  },
  railRightWrapper: {
    right: 10,
  },
  railLeftWrapper: {
    left: 10,
  },
  verticalRailCard: {
    width: 86,
    flex: 1,
    borderRadius: 18,
    paddingTop: 8,
    paddingBottom: 8,
    shadowColor: "#F43F5E",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.85)",
    overflow: "hidden",
    position: "relative",
  },
  railSideAdjustCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginHorizontal: 8,
    marginBottom: 6,
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius: 14,
    backgroundColor: "rgba(255, 241, 242, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(254, 205, 211, 0.8)",
  },
  railSideAdjustText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#E11D48",
  },
  verticalRailScroll: {
    alignItems: "center",
    paddingTop: 2,
    paddingBottom: 8,
    gap: 8,
  },
  railItemBox: {
    width: 72,
    height: 74,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    position: "relative",
  },
  railItemInactive: {
    backgroundColor: "rgba(255, 255, 255, 0.45)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.75)",
  },
  railItemAllActive: {
    backgroundColor: "rgba(255, 228, 235, 0.80)",
    borderWidth: 1.2,
    borderColor: "#F43F5E",
  },
  railItemBoxSelected: {
    backgroundColor: "rgba(255, 228, 235, 0.80)",
    borderWidth: 1.2,
    borderColor: "#F43F5E",
  },
  railActiveIndicatorBar: {
    position: "absolute",
    top: 14,
    bottom: 14,
    width: 4,
    borderRadius: 2,
    backgroundColor: "#F43F5E",
  },
  railFoodIconImg: {
    width: 48,
    height: 38,
  },
  railItemLabel: {
    marginTop: 4,
    fontSize: 10.5,
    fontWeight: "700",
    textAlign: "center",
  },
  railItemAllLabelActive: {
    color: "#E11D48",
    fontWeight: "800",
  },
  railItemLabelInactive: {
    color: "#1F2937",
    fontWeight: "700",
  },
  railItemLabelSelected: {
    color: "#E11D48",
    fontWeight: "800",
  },
  railCloseCard: {
    width: 86,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.85)",
    overflow: "hidden",
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    shadowColor: "#F43F5E",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  railCloseText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
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
