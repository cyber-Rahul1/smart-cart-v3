import React, { useEffect, useRef, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Ionicons } from "@/src/ui";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { useCartSummary } from "@/src/cart";
import { rupee } from "@/src/format";
import { useTabBarVisibility } from "@/src/context/tab-bar-visibility";

type Props = {
  bottomOffset?: number;
  dockSide?: "left" | "right";
  scrollActivityTimestamp?: number;
};

const SCREEN_WIDTH = Dimensions.get("window").width;
const BAR_MARGIN = spacing.lg;
const EXPANDED_WIDTH = SCREEN_WIDTH - BAR_MARGIN * 2;
const COLLAPSED_SIZE = 54;
const SNAP_LEFT = 0;
const SNAP_RIGHT = EXPANDED_WIDTH - COLLAPSED_SIZE;

export function FloatingCartBar({ bottomOffset = 0, dockSide = "left", scrollActivityTimestamp }: Props) {
  const { colors } = useTheme();
  const { hasItems, totalCount, seller, sellers, isMultiStore, grandTotal } = useCartSummary();
  const [isCollapsedState, setIsCollapsedState] = useState(false);
  const tabVisibility = useTabBarVisibility();

  const defaultDockPos = dockSide === "left" ? SNAP_LEFT : SNAP_RIGHT;

  // 0 = fully expanded bar, 1 = collapsed circle
  const collapseProgress = useSharedValue(0);

  // Drag position for collapsed circle (relative to BAR_MARGIN)
  const translateX = useSharedValue(defaultDockPos);

  // Track if user explicitly closed or explicitly expanded the banner
  const [userDismissed, setUserDismissed] = useState(false);
  const userManuallyExpanded = useRef(false);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep collapsed / expanded synced with animated values
  useEffect(() => {
    if (isCollapsedState) {
      collapseProgress.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.quad) });
      translateX.value = withTiming(defaultDockPos, { duration: 240, easing: Easing.out(Easing.quad) });
    } else {
      collapseProgress.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.quad) });
      translateX.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.quad) });
    }
  }, [isCollapsedState, defaultDockPos]);

  const navigateToCart = () => {
    if (tabVisibility && typeof tabVisibility.scrollPageTo === "function") {
      tabVisibility.scrollPageTo(2); // Index 2 is Cart tab in _layout
    } else {
      router.push("/(tabs)/cart");
    }
  };

  const handleCollapse = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    userManuallyExpanded.current = false;
    setUserDismissed(true);
    setIsCollapsedState(true);
  };

  const handleExpand = () => {
    // Immediately cancel any pending scroll inactivity timer so it doesn't snap shut mid-way!
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    userManuallyExpanded.current = true;
    setUserDismissed(false);
    setIsCollapsedState(false);
  };

  // Animated styles for width, height, borderRadius, background color and translation
  // (Always call hooks unconditionally before any early returns to satisfy React Rules of Hooks)
  const containerAnimStyle = useAnimatedStyle(() => {
    const w = interpolate(collapseProgress.value, [0, 1], [EXPANDED_WIDTH, COLLAPSED_SIZE]);
    const h = interpolate(collapseProgress.value, [0, 1], [60, COLLAPSED_SIZE]);
    const r = interpolate(collapseProgress.value, [0, 1], [18, COLLAPSED_SIZE / 2]);
    const bg = "#16A34A"; // Fresh vibrant green

    const currentTranslateX = interpolate(
      collapseProgress.value,
      [0, 1],
      [0, translateX.value]
    );

    return {
      width: w,
      height: h,
      borderRadius: r,
      backgroundColor: bg,
      transform: [{ translateX: currentTranslateX }],
    };
  });

  const expandedContentAnimStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(collapseProgress.value, [0, 0.45], [1, 0]),
      transform: [
        {
          scale: interpolate(collapseProgress.value, [0, 0.5], [1, 0.85]),
        },
      ],
    };
  });

  const collapsedContentAnimStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(collapseProgress.value, [0.55, 1], [0, 1]),
      transform: [
        {
          scale: interpolate(collapseProgress.value, [0.5, 1], [0.6, 1]),
        },
      ],
    };
  });

  // Unconditional render check after all hooks have been invoked
  if (!hasItems || !seller) return null;

  const discountRemaining = Math.max(0, 299 - grandTotal);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.outerWrap,
        { bottom: bottomOffset + spacing.md },
      ]}
    >
      <Animated.View style={[styles.barCard, { shadowColor: "#16A34A" }, containerAnimStyle]}>
        {/* Expanded Bar Content */}
        <Animated.View
          pointerEvents={isCollapsedState ? "none" : "auto"}
          style={[styles.expandedWrapper, expandedContentAnimStyle]}
        >
          <Pressable
            testID="floating-cart-view"
            style={styles.mainPressable}
            onPress={navigateToCart}
          >
            {/* Left: Cart Icon with Badge */}
            <View style={styles.cartIconWithBadge}>
              <Ionicons name="cart" size={24} color="#FFFFFF" />
              <View style={styles.cartCountBadge}>
                <Text style={[styles.cartCountBadgeText, { color: "#16A34A" }]}>
                  {totalCount > 99 ? "99+" : totalCount}
                </Text>
              </View>
            </View>

            {/* Vertical Divider */}
            <View style={styles.cartBarDivider} />

            {/* Middle: Items & Total Price & Discount Prompt / Store info */}
            <View style={styles.cartBarMiddle}>
              <Text style={styles.cartBarMainText}>
                {totalCount} item{totalCount > 1 ? "s" : ""} • {rupee(grandTotal)}
              </Text>
              <Text style={styles.cartBarSubText} numberOfLines={1}>
                {discountRemaining > 0
                  ? `Add ${rupee(discountRemaining)} more for ₹30 OFF`
                  : "₹30 OFF unlocked on your bill!"}
              </Text>
            </View>

            {/* Right: View Cart Button Pill */}
            <View style={styles.viewCartPill}>
              <Text style={[styles.viewCartPillText, { color: "#16A34A" }]}>View Cart</Text>
              <Ionicons name="arrow-forward" size={14} color="#16A34A" />
            </View>
          </Pressable>

          {/* Close / Collapse Button */}
          <Pressable
            testID="floating-cart-collapse"
            style={styles.collapseBtn}
            hitSlop={8}
            onPress={handleCollapse}
          >
            <Ionicons name="close" size={17} color="#FFFFFF" />
          </Pressable>
        </Animated.View>

        {/* Collapsed Circle Content */}
        <Animated.View
          pointerEvents={isCollapsedState ? "auto" : "none"}
          style={[styles.collapsedWrapper, collapsedContentAnimStyle]}
        >
          <Pressable
            testID="collapsed-cart-tap"
            style={styles.collapsedPressArea}
            onPress={handleExpand}
            hitSlop={10}
          >
            <Ionicons name="cart" size={24} color="#FFFFFF" />
            <View style={[styles.badge, { backgroundColor: "#FFFFFF" }]}>
              <Text style={[styles.badgeText, { color: "#16A34A" }]}>
                {totalCount > 99 ? "99+" : totalCount}
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrap: {
    position: "absolute",
    left: BAR_MARGIN,
    right: BAR_MARGIN,
    zIndex: 999,
    elevation: 20,
  },
  barCard: {
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  expandedWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 14,
    paddingRight: 8,
  },
  mainPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 6,
  },
  cartIconWithBadge: {
    position: "relative",
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  cartCountBadge: {
    position: "absolute",
    top: -4,
    right: -6,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  cartCountBadgeText: {
    fontSize: 10.5,
    fontWeight: "900",
  },
  cartBarDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    marginHorizontal: 10,
  },
  cartBarMiddle: {
    flex: 1,
    justifyContent: "center",
  },
  cartBarMainText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13.5,
    letterSpacing: -0.2,
  },
  cartBarSubText: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 10.5,
    fontWeight: "600",
    marginTop: 1,
  },
  viewCartPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    marginRight: 4,
  },
  viewCartPillText: {
    fontWeight: "800",
    fontSize: 11.5,
  },
  collapseBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0, 0, 0, 0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  collapsedWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  collapsedPressArea: {
    width: COLLAPSED_SIZE,
    height: COLLAPSED_SIZE,
    borderRadius: COLLAPSED_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    elevation: 14,
    zIndex: 100,
  },
  badgeText: {
    fontWeight: "900",
    fontSize: 9.5,
  },
});
