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

export function SellerTile({ s, testID, rank }: { s: Seller; testID: string; rank?: number }) {
  const st = useStyles();
  return (
    <Pressable testID={testID} onPress={() => router.push(`/seller/${s.id}`)} style={({ pressed }) => [st.tile, pressed && { transform: [{ scale: 0.98 }] }]}>
      <AppImage source={{ uri: mediaUri(s.image) }} fallbackType={s.category === "grocery" ? "groceries" : "shop"} style={st.tileImg} contentFit="cover" transition={200} />
      {rank ? <View style={st.rank}><Text style={st.rankText}>#{rank}</Text></View> : null}
      <Text style={st.tileName} numberOfLines={1}>{s.name}</Text>
      <Text style={st.tileMeta} numberOfLines={1}>★ {s.rating} · {s.eta_min} mins</Text>
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
            <View key={`${s.id}-img-${i}`} style={{ width: cardWidth, height: 190, overflow: "hidden" }}>
              <AppImage
                source={{ uri: mediaUri(imgUri) }}
                fallbackType={s.category === "grocery" ? "groceries" : "shop"}
                style={{ width: cardWidth, height: 190 }}
                contentFit="cover"
                transition={0}
              />
            </View>
          ))}
        </ScrollView>

        {/* Gradient shadow overlay for text and badges */}
        <LinearGradient
          colors={["rgba(0,0,0,0.4)", "transparent", "rgba(0,0,0,0.65)"]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Top Header Row on Image: Bookmark/Save Icon at top-right */}
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
                  color="rgba(0, 0, 0, 0.18)"
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

        {/* Bottom Bar on Image: Offer badge (bottom-left) + Carousel Dots with progress (bottom-right) */}
        <View style={st.imageBottomRow} pointerEvents="none">
          {s.offer ? (
            <View style={st.fullCardOfferBadge}>
              <Ionicons name="pricetag" size={13} color="#FFFFFF" />
              <Text style={st.fullCardOfferText} numberOfLines={1}>
                {s.offer}
              </Text>
            </View>
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
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
          <Text style={st.fullCardName} numberOfLines={1}>
            {truncate(s.name, 30, 20)}
          </Text>
          {s.is_new ? (
            <View style={st.newTag}>
              <Text style={st.newText}>NEW</Text>
            </View>
          ) : null}
        </View>

        {/* Rating and Distance Row */}
        <View style={st.metaRow}>
          <View style={st.ratingBadge}>
            <Ionicons name="star" size={11} color="#FFFFFF" />
            <Text style={st.ratingText}>{s.rating.toFixed(1)}</Text>
          </View>
          <Text style={st.metaDot}>•</Text>
          <Text style={st.metaText}>{s.distance_km} km</Text>
          <Text style={st.metaDot}>•</Text>
          <Text style={st.metaText} numberOfLines={1}>{truncate(s.address || "Nearby", 28, 16)}</Text>
        </View>

        {/* Cuisine & Business / FSSAI type */}
        <Text style={st.fullCardCuisine} numberOfLines={1}>
          {truncate(s.cuisine || s.category, 42, 26)}
        </Text>
        <Text style={st.fullCardType} numberOfLines={1}>
          {truncate(
            `${s.business_type === "cloud_kitchen" ? "Cloud kitchen" : s.category === "grocery" ? "Grocery store" : "Restaurant"}${s.fssai_status === "verified" ? "  ·  FSSAI verified" : ""}`,
            48,
            30
          )}
        </Text>
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

  // Full Card Styles
  fullCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    overflow: "hidden",
    shadowColor: c.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: c.border,
  },
  imageContainer: {
    width: "100%",
    height: 190,
    backgroundColor: c.surfaceTertiary,
    overflow: "hidden",
  },
  imageTopRow: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
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
    gap: 4,
    backgroundColor: c.brandPrimary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  fullCardOfferText: {
    color: "#FFFFFF",
    fontSize: 11,
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
    backgroundColor: "#FFFFFF",
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
    padding: spacing.md,
    gap: 3,
  },
  fullCardName: {
    fontSize: font.lg + 1,
    fontWeight: "800",
    color: c.onSurface,
    flex: 1,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#228B22",
    borderRadius: radius.sm - 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  ratingText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  metaDot: {
    color: c.muted,
    fontSize: 12,
  },
  metaText: {
    fontSize: font.sm + 1,
    color: c.onSurfaceSecondary,
    fontWeight: "600",
  },
  fullCardCuisine: {
    fontSize: font.sm + 1,
    color: c.muted,
    marginTop: 1,
  },
  fullCardType: {
    fontSize: font.sm,
    color: c.muted,
    marginTop: 1,
  },
}));
