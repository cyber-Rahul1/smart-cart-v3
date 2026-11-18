import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";

import { Ionicons } from "@/src/ui";
import { colors as c, radius, spacing } from "@/src/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Geometry for horizontal centered carousel with side peeking
export const BANNER_CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.78); // ~312px on 400px screen
export const BANNER_CARD_HEIGHT = 152;
export const BANNER_GAP = 12;
export const ITEM_TOTAL_WIDTH = BANNER_CARD_WIDTH + BANNER_GAP;
export const SIDE_INSET = (SCREEN_WIDTH - BANNER_CARD_WIDTH) / 2;

// Multiple loops to enable seamless infinite scroll in both directions
const LOOPS = 30; // 30 sets of banners

export interface BannerItem {
  key: string;
  title: string;
  cta: string;
  href: string;
  image: string;
  gradColors: readonly [string, string];
}

interface BannerCardProps {
  banner: BannerItem;
  index: number;
  scrollX: SharedValue<number>;
  onPress: () => void;
}

function BannerCard({ banner, index, scrollX, onPress }: BannerCardProps) {
  const cardAnimatedStyle = useAnimatedStyle(() => {
    // Center point of this item in the scroll content
    const itemCenter = index * ITEM_TOTAL_WIDTH;
    const distance = Math.abs(scrollX.value - itemCenter);

    // Active center banner has scale 1.0; side banners scale down to 0.88
    const scale = interpolate(
      distance,
      [0, ITEM_TOTAL_WIDTH, ITEM_TOTAL_WIDTH * 2],
      [1.0, 0.88, 0.84],
      Extrapolation.CLAMP
    );

    // Opacity: center banner is 1.0, side banners slightly dimmed (0.78)
    const opacity = interpolate(
      distance,
      [0, ITEM_TOTAL_WIDTH, ITEM_TOTAL_WIDTH * 2],
      [1.0, 0.78, 0.65],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        styles.bannerCardWrapper,
        cardAnimatedStyle,
      ]}
    >
      <Pressable
        testID={`home-ad-banner-${banner.key}-${index}`}
        onPress={onPress}
        style={styles.adBannerCard}
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
          style={styles.bannerInner}
        >
          <Text style={styles.bannerTitle}>{banner.title}</Text>
          <View style={styles.bannerCta}>
            <Text style={styles.bannerCtaText}>{banner.cta}</Text>
            <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

interface InfiniteBannerCarouselProps {
  banners: BannerItem[];
  isActive?: boolean; // tab active state
  setPagerScrollEnabled?: (enabled: boolean) => void;
}

export function InfiniteBannerCarousel({
  banners,
  isActive = true,
  setPagerScrollEnabled,
}: InfiniteBannerCarouselProps) {
  const scrollRef = useRef<Animated.ScrollView>(null);
  const scrollX = useSharedValue(0);

  const N = banners.length;
  const loopWidth = N * ITEM_TOTAL_WIDTH;
  const middleLoop = Math.floor(LOOPS / 2); // e.g. 15
  const initialIndex = middleLoop * N;

  // Flatten repeated banner items
  const repeatedBanners = useMemo(() => {
    const list: { banner: BannerItem; loopIdx: number; origIdx: number; key: string }[] = [];
    for (let loop = 0; loop < LOOPS; loop++) {
      for (let i = 0; i < N; i++) {
        list.push({
          banner: banners[i],
          loopIdx: loop,
          origIdx: i,
          key: `loop-${loop}-item-${i}-${banners[i].key}`,
        });
      }
    }
    return list;
  }, [banners, N]);

  const currentIndexRef = useRef(initialIndex);
  const isDraggingRef = useRef(false);
  const autoPlayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scroll position tracking with reanimated
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
    onBeginDrag: () => {
      // User started dragging
    },
    onEndDrag: () => {
      // User ended dragging
    },
  });

  // Center jump when reaching boundaries to ensure infinite loop
  const checkBoundsAndNormalize = useCallback((targetOffset: number) => {
    const minSafeOffset = 2 * loopWidth;
    const maxSafeOffset = (LOOPS - 3) * loopWidth;

    if (targetOffset < minSafeOffset || targetOffset > maxSafeOffset) {
      // Calculate original index modulo N
      const rawIndex = Math.round(targetOffset / ITEM_TOTAL_WIDTH);
      const origIndex = ((rawIndex % N) + N) % N;
      const normalizedIndex = middleLoop * N + origIndex;
      const normalizedOffset = normalizedIndex * ITEM_TOTAL_WIDTH;

      currentIndexRef.current = normalizedIndex;
      scrollX.value = normalizedOffset;
      scrollRef.current?.scrollTo({ x: normalizedOffset, animated: false });
    }
  }, [N, loopWidth, middleLoop, scrollX]);

  // Jump to middle loop on initial mount
  useEffect(() => {
    const initialOffset = initialIndex * ITEM_TOTAL_WIDTH;
    scrollX.value = initialOffset;
    // Small timeout to allow layout to measure
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: initialOffset, animated: false });
    }, 50);
    return () => clearTimeout(timer);
  }, [initialIndex, scrollX]);

  // Handle auto-scroll rotation
  const advanceNext = useCallback(() => {
    if (isDraggingRef.current) return;
    const nextIndex = currentIndexRef.current + 1;
    currentIndexRef.current = nextIndex;
    scrollRef.current?.scrollTo({
      x: nextIndex * ITEM_TOTAL_WIDTH,
      animated: true,
    });
  }, []);

  // Timer for smooth auto-rotation every 4 seconds
  useEffect(() => {
    if (!isActive) return;

    autoPlayTimerRef.current = setInterval(() => {
      advanceNext();
    }, 4000);

    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, [isActive, advanceNext]);

  const onScrollBeginDrag = () => {
    isDraggingRef.current = true;
    if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    setPagerScrollEnabled?.(false);
  };

  const onScrollEndDrag = () => {
    setPagerScrollEnabled?.(true);
    // Restart timer after drag
    if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    if (isActive) {
      autoPlayTimerRef.current = setInterval(advanceNext, 4000);
    }
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    isDraggingRef.current = false;
    setPagerScrollEnabled?.(true);
    const offsetX = e.nativeEvent.contentOffset.x;
    const settledIndex = Math.round(offsetX / ITEM_TOTAL_WIDTH);
    currentIndexRef.current = settledIndex;

    // Check if we need to silently re-center
    checkBoundsAndNormalize(offsetX);
  };

  return (
    <View style={styles.carouselContainer}>
      <Animated.ScrollView
        ref={scrollRef as any}
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        decelerationRate="fast"
        snapToInterval={ITEM_TOTAL_WIDTH}
        snapToAlignment="start"
        contentContainerStyle={{
          paddingHorizontal: SIDE_INSET,
        }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        style={styles.scrollView}
      >
        {repeatedBanners.map((item, idx) => (
          <BannerCard
            key={item.key}
            banner={item.banner}
            index={idx}
            scrollX={scrollX}
            onPress={() => router.push(item.banner.href as any)}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  carouselContainer: {
    marginTop: 14,
    marginBottom: 12,
    height: BANNER_CARD_HEIGHT + 14,
    justifyContent: "center",
  },
  scrollView: {
    overflow: "visible",
  },
  bannerCardWrapper: {
    width: BANNER_CARD_WIDTH,
    height: BANNER_CARD_HEIGHT,
    marginRight: BANNER_GAP,
    justifyContent: "center",
    alignItems: "center",
  },
  adBannerCard: {
    width: "100%",
    height: "100%",
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: c.surfaceTertiary,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
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
});
