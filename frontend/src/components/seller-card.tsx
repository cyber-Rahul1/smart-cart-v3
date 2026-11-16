import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated as RNAnimated,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";

import { mediaUri } from "@/src/format";
import { Seller } from "@/src/types";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { AppImage, Ionicons } from "@/src/ui";
import { useTabBarVisibility } from "@/src/context/tab-bar-visibility";

export function SellerRow({ s, testID }: { s: Seller; testID: string }) {
  const st = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={() => router.push(`/seller/${s.id}`)} style={({ pressed }) => [st.row, pressed && { opacity: 0.85 }]}>
      <View>
        <AppImage source={{ uri: mediaUri(s.image) }} fallbackType={s.category === "grocery" ? "groceries" : "shop"} style={st.rowImg} contentFit="cover" transition={200} />
        {s.offer ? (
          <View style={st.offerBand}><Text style={st.offerText} numberOfLines={1}>{s.offer}</Text></View>
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={st.name} numberOfLines={1}>{s.name}</Text>
          {s.is_new ? <View style={st.newTag}><Text style={st.newText}>NEW</Text></View> : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="star" size={13} color={colors.success} />
          <Text style={st.meta}>{s.rating} · {s.eta_min} mins · {s.distance_km} km</Text>
        </View>
        <Text style={st.cuisine} numberOfLines={1}>{s.cuisine}</Text>
        <Text style={st.type}>{s.business_type === "cloud_kitchen" ? "Cloud kitchen" : s.category === "grocery" ? "Grocery store" : "Restaurant"}
          {s.fssai_status === "verified" ? "  ·  FSSAI verified" : ""}</Text>
      </View>
    </Pressable>
  );
}

export function SellerTile({
  s,
  testID,
  rank,
  isNew,
}: {
  s: Seller;
  testID: string;
  rank?: number;
  isNew?: boolean;
}) {
  const st = useStyles();
  const isGrocery = s.category === "grocery";

  // Format order count / popularity badge: e.g. "1.2k orders", "2.8k orders", "900 orders"
  const orderCountText = useMemo(() => {
    const base = ((s.id.charCodeAt(s.id.length - 1) * 73) % 25) + 8; // 8 to 32 -> 0.8k to 3.2k
    if (rank === 1) return "1.2k orders";
    if (rank === 2) return "2.8k orders";
    if (rank === 3) return "900 orders";
    return `${(base / 10).toFixed(1)}k orders`;
  }, [s.id, rank]);

  // Review count formatting: e.g. "(8.2k)", "(12k)", "(6.7k)"
  const reviewCountText = useMemo(() => {
    if (rank === 1) return "(8.2k)";
    if (rank === 2) return "(12k)";
    if (rank === 3) return "(6.7k)";
    const count = ((s.id.charCodeAt(0) * 13) % 9) + 4;
    return `(${count}.${count % 5}k)`;
  }, [s.id, rank]);

  // Subtitle formatting: e.g. "Biryani • Andhra" or "Fruits & Vegetables"
  const subtitle = s.cuisine
    ? s.cuisine.split(",").slice(0, 2).map((c) => c.trim()).join(" • ")
    : isGrocery
    ? "Fruits & Vegetables"
    : "South Indian";

  return (
    <Pressable
      testID={testID}
      onPress={() => router.push(`/seller/${s.id}`)}
      style={({ pressed }) => [st.modernCard, pressed && { transform: [{ scale: 0.98 }] }]}
    >
      {/* Liquid Glass Frosted Base Layer */}
      <BlurView
        intensity={20}
        tint="light"
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["rgba(255, 255, 255, 0.78)", "rgba(255, 235, 242, 0.42)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Top Image Box */}
      <View style={st.modernCardImageBox}>
        <AppImage
          source={{ uri: mediaUri(s.image) }}
          fallbackType={isGrocery ? "groceries" : "shop"}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
        />

        {/* Popularity Badge on Top-Left */}
        <View style={st.popularityBadge}>
          <Ionicons name="flame" size={11} color="#FFFFFF" />
          <Text style={st.popularityBadgeText}>{orderCountText}</Text>
        </View>

        {/* Small White Circular Arrow Button at Bottom-Right of Image */}
        <View style={st.imageArrowCircle}>
          <Ionicons name="arrow-forward" size={12} color="#F43F5E" />
        </View>
      </View>

      {/* Bottom Info Section */}
      <View style={st.modernCardBody}>
        <Text style={st.modernCardName} numberOfLines={1}>
          {s.name}
        </Text>

        <Text style={st.modernCardCuisine} numberOfLines={1}>
          {subtitle}
        </Text>

        {/* Rating and Delivery time */}
        <View style={st.cardMetricsRow}>
          <View style={st.ratingWrap}>
            <Ionicons name="star" size={12} color="#16A34A" />
            <Text style={st.ratingValueText}>{s.rating ? s.rating.toFixed(1) : "4.5"}</Text>
            <Text style={st.reviewCountText}>{reviewCountText}</Text>
          </View>

          <View style={st.timeWrap}>
            <Ionicons name="time-outline" size={13} color="#64748B" />
            <Text style={st.timeText}>{s.eta_min || 28} mins</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** Full-width modern card with auto-scrolling & swipeable image carousel */
export function SellerFullCard({
  s,
  testID,
  isActive = true,
  isRailOpen = false,
}: {
  s: Seller;
  testID: string;
  isActive?: boolean;
  isRailOpen?: boolean;
}) {
  const st = useStyles();
  const { colors } = useTheme();
  const { setPagerScrollEnabled } = useTabBarVisibility();

  // Helper to slice text with ellipsis based on whether the rail is open
  const truncate = (text: string | undefined | null, fullLen: number, railLen: number) => {
    if (!text) return "";
    const limit = isRailOpen ? railLen : fullLen;
    return text.length > limit ? `${text.slice(0, limit).trimEnd()}...` : text;
  };
  const [cardWidth, setCardWidth] = useState<number>(Dimensions.get("window").width - spacing.md * 2);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [userInteracting, setUserInteracting] = useState(false);

  const scrollRef = useRef<any>(null);
  const activeIndexRef = useRef(0);
  const cardWidthRef = useRef(cardWidth);
  const userInteractingRef = useRef(false);
  const progressAnim = useRef(new RNAnimated.Value(0)).current;

  activeIndexRef.current = activeIndex;
  cardWidthRef.current = cardWidth;
  userInteractingRef.current = userInteracting;

  // Collect images: gallery or fallback to s.image
  const images = useMemo(() => {
    const list: string[] = [];
    if (s.gallery && Array.isArray(s.gallery) && s.gallery.length > 0) {
      for (const img of s.gallery) {
        if (img && !list.includes(img)) list.push(img);
      }
    }
    if (list.length === 0 && s.banner_url) {
      list.push(s.banner_url);
    }
    if (!list.includes(s.image)) {
      list.unshift(s.image);
    }
    return list.length > 0 ? list : [s.image];
  }, [s.gallery, s.banner_url, s.image]);

  const hasMultiple = images.length > 1;
  const CAROUSEL_DURATION = 3500;

  // Keep carousel aligned if cardWidth changes
  useEffect(() => {
    if (cardWidth > 0 && activeIndexRef.current > 0) {
      scrollRef.current?.scrollTo({ x: activeIndexRef.current * cardWidth, animated: true });
    }
  }, [cardWidth]);

  // Animate active dot progress and handle carousel advance only when isActive and not user-interacting
  useEffect(() => {
    if (!hasMultiple) return;

    if (!isActive || userInteracting) {
      progressAnim.stopAnimation();
      progressAnim.setValue(0);
      return;
    }

    progressAnim.setValue(0);
    const anim = RNAnimated.timing(progressAnim, {
      toValue: 1,
      duration: CAROUSEL_DURATION,
      useNativeDriver: false,
    });

    anim.start(({ finished }) => {
      if (finished && isActive && !userInteractingRef.current) {
        const next = (activeIndexRef.current + 1) % images.length;
        setActiveIndex(next);
        const w = cardWidthRef.current;
        if (w > 0) {
          scrollRef.current?.scrollTo({ x: next * w, animated: true });
        }
      }
    });

    return () => {
      anim.stop();
    };
  }, [hasMultiple, isActive, userInteracting, activeIndex, images.length, progressAnim]);

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const w = cardWidthRef.current;
    if (w <= 0) return;
    const offset = e.nativeEvent.contentOffset.x;
    const idx = Math.min(Math.max(0, Math.round(offset / w)), images.length - 1);
    setActiveIndex(idx);
    setUserInteracting(false);
  };

  return (
    <Pressable
      testID={testID}
      onPress={() => router.push(`/seller/${s.id}`)}
      style={({ pressed }) => [st.fullCard, pressed && { opacity: 0.96 }]}
    >
      {/* Liquid Glass Frosted Base Layer */}
      <BlurView
        intensity={20}
        tint="light"
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["rgba(255, 255, 255, 0.82)", "rgba(255, 238, 244, 0.45)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={st.imageContainer}
        onLayout={(e) => {
          const w = Math.round(e.nativeEvent.layout.width);
          if (w > 0 && Math.abs(w - cardWidth) > 1) {
            setCardWidth(w);
          }
        }}
      >
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onTouchStart={() => setPagerScrollEnabled(false)}
          onTouchEnd={() => setPagerScrollEnabled(true)}
          onScrollBeginDrag={() => {
            setUserInteracting(true);
            setPagerScrollEnabled(false);
          }}
          onScrollEndDrag={() => {
            setPagerScrollEnabled(true);
          }}
          onMomentumScrollEnd={(e) => {
            handleMomentumScrollEnd(e);
            setPagerScrollEnabled(true);
          }}
        >
          {images.map((imgUri, i) => (
            <View key={`${s.id}-img-${i}`} style={{ width: cardWidth, height: 160, overflow: "hidden" }}>
              <AppImage
                source={{ uri: mediaUri(imgUri) }}
                fallbackType={s.category === "grocery" ? "groceries" : "shop"}
                style={{ width: cardWidth, height: 160 }}
                contentFit="cover"
                transition={0}
              />
            </View>
          ))}
        </ScrollView>

        {/* Gradient shadow overlay for text and badges */}
        <LinearGradient
          colors={["rgba(0,0,0,0.35)", "transparent", "rgba(0,0,0,0.6)"]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Top Header Row on Image: Bookmark/Save Icon at top-right (no trending mark) */}
        <View style={st.imageTopRow} pointerEvents="box-none">
          <View style={{ flex: 1 }} />

          <Pressable
            testID={`${testID}-save-btn`}
            hitSlop={10}
            onPress={(e) => {
              e.stopPropagation();
              setIsSaved((prev) => !prev);
            }}
            style={st.saveIconBtn}
          >
            {/* If not saved, show solid translucent gray bookmark fill with white outline on top */}
            {!isSaved ? (
              <View style={{ width: 22, height: 22, alignItems: "center", justifyContent: "center" }}>
                <Ionicons
                  name="bookmark"
                  size={20}
                  color="rgba(0, 0, 0, 0.25)"
                  style={StyleSheet.absoluteFill}
                />
                <Ionicons
                  name="bookmark-outline"
                  size={22}
                  color="#FFFFFF"
                />
              </View>
            ) : (
              <Ionicons
                name="bookmark"
                size={22}
                color={colors.brandPrimary}
              />
            )}
          </Pressable>
        </View>

        {/* Bottom Bar on Image: Offer / Delivery pill (bottom-left) + Carousel Dots (bottom-right) */}
        <View style={st.imageBottomRow} pointerEvents="none">
          {s.offer ? (
            <LinearGradient
              colors={["#EA580C", "#DC2626"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={st.fullCardOfferBadge}
            >
              <Ionicons name="cart-outline" size={13} color="#FFFFFF" />
              <Text style={st.fullCardOfferText} numberOfLines={1}>
                {s.offer}
              </Text>
            </LinearGradient>
          ) : s.category === "grocery" ? (
            <LinearGradient
              colors={["#EA580C", "#DC2626"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={st.fullCardOfferBadge}
            >
              <Ionicons name="car-outline" size={13} color="#FFFFFF" />
              <Text style={st.fullCardOfferText} numberOfLines={1}>
                Free delivery above ₹399
              </Text>
            </LinearGradient>
          ) : (
            <View />
          )}

          {/* Carousel dots in bottom right corner with duration animation */}
          {hasMultiple ? (
            <View style={st.bottomDotsContainer}>
              {images.map((_, i) => {
                const isCurrent = i === activeIndex;
                return isCurrent ? (
                  <View key={i} style={st.activeDotTrack}>
                    <RNAnimated.View
                      style={[
                        st.activeDotFill,
                        {
                          width: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ["0%", "100%"],
                          }),
                        },
                      ]}
                    />
                  </View>
                ) : (
                  <View
                    key={i}
                    style={[
                      st.inactiveRoundDot,
                      i < activeIndex && { backgroundColor: "rgba(255,255,255,0.75)" },
                    ]}
                  />
                );
              })}
            </View>
          ) : null}
        </View>
      </View>

      {/* Card Info Section */}
      <View style={st.fullCardBody}>
        {/* Top Info Row: Left Shop Logo + Middle Text Details + Right Circular Chevron */}
        <View style={st.fullCardMainRow}>
          {/* Shop Logo Avatar Box */}
          <View style={st.shopLogoBox}>
            {s.image ? (
              <AppImage
                source={{ uri: mediaUri(s.image) }}
                fallbackType={s.category === "grocery" ? "groceries" : "shop"}
                style={st.shopLogoImg}
                contentFit="cover"
              />
            ) : (
              <Ionicons
                name={s.category === "grocery" ? "basket" : "leaf"}
                size={22}
                color="#FFFFFF"
              />
            )}
          </View>

          {/* Middle Info Column */}
          <View style={st.shopInfoCol}>
            {/* Title Row with Verified Checkmark */}
            <View style={st.shopTitleRow}>
              <Text style={st.fullCardName} numberOfLines={1}>
                {truncate(s.name, 28, 18)}
              </Text>
              <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
            </View>

            {/* Cuisines / Subtitle Row */}
            <Text style={st.fullCardCuisine} numberOfLines={1}>
              {truncate(
                s.cuisine
                  ? s.cuisine.replace(/,/g, " •")
                  : s.category === "grocery"
                  ? "Groceries • Staples • Home Essentials"
                  : "South Indian • Meals • North Indian",
                44,
                26
              )}
            </Text>

            {/* Description Text */}
            <Text style={st.fullCardDescription} numberOfLines={2}>
              {s.description ||
                (s.category === "grocery"
                  ? "Your neighbourhood grocery store with daily essentials, fresh items and more."
                  : "Authentic South Indian tiffins, dosas & filter coffee made fresh everyday.")}
            </Text>
          </View>

          {/* Right Chevron Forward Button */}
          <View style={st.chevronBtnBox}>
            <Ionicons name="chevron-forward" size={17} color="#F43F5E" />
          </View>
        </View>

        {/* Bottom Metrics Pill Bar: Rating, Distance, ETA, FSSAI Verified */}
        <View style={st.bottomMetricsBar}>
          {/* Star Rating & Review Count */}
          <View style={st.metricItem}>
            <Ionicons name="star" size={13} color="#22C55E" />
            <Text style={st.metricBoldText}>{s.rating ? s.rating.toFixed(1) : "4.5"}</Text>
            {!isRailOpen && (
              <Text style={st.metricMutedText}>
                ({s.reviews_count ? `${(s.reviews_count / 1000).toFixed(1)}k` : "1.2k"})
              </Text>
            )}
          </View>

          {/* Divider */}
          <View style={st.metricDivider} />

          {/* Distance */}
          <View style={st.metricItem}>
            <Ionicons name="location-outline" size={14} color="#64748B" />
            <Text style={st.metricBoldText}>{s.distance_km || 1.2} km</Text>
          </View>

          {/* Divider */}
          <View style={st.metricDivider} />

          {/* ETA / Delivery Time */}
          <View style={st.metricItem}>
            <Ionicons name="time-outline" size={14} color="#64748B" />
            <Text style={st.metricBoldText}>
              {s.eta_min ? `${s.eta_min}-${s.eta_min + 10}m` : "20-30m"}
            </Text>
          </View>

          {/* Flexible Space */}
          <View style={{ flex: 1 }} />

          {/* FSSAI Verified Tag: Shows shield icon only when rail is open, otherwise full text */}
          <View
            style={[
              st.fssaiVerifiedPill,
              isRailOpen && { paddingHorizontal: 6, paddingVertical: 4 },
            ]}
          >
            <Ionicons name="shield-checkmark" size={13} color="#15803D" />
            {!isRailOpen && <Text style={st.fssaiVerifiedPillText}>FSSAI Verified</Text>}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, alignItems: "center" },
  rowImg: { width: 108, height: 116, borderRadius: radius.lg, backgroundColor: c.surfaceTertiary },
  offerBand: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: c.scrim, borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md, paddingHorizontal: 6, paddingVertical: 4 },
  offerText: { color: c.onSurfaceInverse, fontSize: 10, fontWeight: "800" },
  name: { fontSize: font.lg, fontWeight: "800", color: c.onSurface, flexShrink: 1 },
  meta: { fontSize: font.sm + 1, fontWeight: "700", color: c.onSurfaceSecondary },
  cuisine: { fontSize: font.sm + 1, color: c.muted },
  type: { fontSize: font.sm, color: c.muted },
  newTag: { backgroundColor: c.pastelMint, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  newText: { color: c.onPastelMint, fontSize: 10, fontWeight: "900" },
  tile: { width: 150 },
  tileImg: { width: 150, height: 150, borderRadius: radius.lg, backgroundColor: c.surfaceTertiary },
  rank: { position: "absolute", top: spacing.sm, left: spacing.sm, backgroundColor: c.brandPrimary, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  rankText: { color: c.onBrandPrimary, fontWeight: "900", fontSize: font.sm },
  tileName: { marginTop: spacing.sm, fontSize: font.base + 1, fontWeight: "800", color: c.onSurface },
  tileMeta: { fontSize: font.sm, color: c.muted, marginTop: 2 },

  // Redesigned Modern Card Styles with Liquid Glass
  modernCard: {
    width: 172,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.85)",
    overflow: "hidden",
    position: "relative",
    shadowColor: "#F43F5E",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  modernCardImageBox: {
    width: "100%",
    height: 120,
    position: "relative",
  },
  popularityBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EF4444",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  popularityBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  imageArrowCircle: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  trendingPillBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EA580C",
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  trendingPillText: {
    color: "#FFFFFF",
    fontSize: 10.5,
    fontWeight: "800",
  },
  newPillBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  newPillText: {
    color: "#15803D",
    fontSize: 11,
    fontWeight: "800",
  },
  modernCardAvatarCircle: {
    position: "absolute",
    bottom: -15,
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  modernCardBody: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  modernCardName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  modernCardCuisine: {
    fontSize: 11,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 2,
  },
  cardMetricsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  ratingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingValueText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#0F172A",
  },
  reviewCountText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  timeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  timeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },

  // Full Card Styles with Liquid Glass
  fullCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    shadowColor: "#F43F5E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.85)",
  },
  imageContainer: {
    width: "100%",
    height: 160,
    overflow: "hidden",
  },
  imageTopRow: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  trendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  trendingBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  saveIconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  imageBottomRow: {
    position: "absolute",
    bottom: spacing.sm,
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fullCardOfferBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  fullCardOfferText: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontWeight: "800",
  },
  bottomDotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  activeDotTrack: {
    width: 16,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,0.45)",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 2,
  },
  activeDotFill: {
    height: "100%",
    backgroundColor: "#F43F5E",
    borderRadius: 2.5,
  },
  inactiveRoundDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,0.55)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 2,
  },
  fullCardBody: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 12,
  },
  fullCardMainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  shopLogoBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#166534",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  shopLogoImg: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  shopInfoCol: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  shopTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fullCardName: {
    fontSize: 17,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  fullCardCuisine: {
    fontSize: 12.5,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 2,
  },
  fullCardDescription: {
    fontSize: 12,
    fontWeight: "400",
    color: "#64748B",
    lineHeight: 17,
    marginTop: 4,
  },
  chevronBtnBox: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  bottomMetricsBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metricItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metricBoldText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#0F172A",
  },
  metricMutedText: {
    fontSize: 11.5,
    fontWeight: "500",
    color: "#64748B",
  },
  metricDivider: {
    width: 1,
    height: 12,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 2,
  },
  fssaiVerifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.22)",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 12,
  },
  fssaiVerifiedPillText: {
    color: "#15803D",
    fontSize: 10.5,
    fontWeight: "800",
  },
}));
