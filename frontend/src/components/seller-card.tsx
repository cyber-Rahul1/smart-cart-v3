import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated as RNAnimated,
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
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
import { Ionicons } from "@/src/ui";
import { useTabBarVisibility } from "@/src/context/tab-bar-visibility";

export function SellerRow({ s, testID }: { s: Seller; testID: string }) {
  const st = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={() => router.push(`/seller/${s.id}`)} style={({ pressed }) => [st.row, pressed && { opacity: 0.85 }]}>
      <View>
        <Image source={{ uri: mediaUri(s.image) }} style={st.rowImg} contentFit="cover" transition={200} />
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
      <Image source={{ uri: mediaUri(s.image) }} style={st.tileImg} contentFit="cover" transition={200} />
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
}: {
  s: Seller;
  testID: string;
  isActive?: boolean;
}) {
  const st = useStyles();
  const { colors } = useTheme();
  const { setPagerScrollEnabled } = useTabBarVisibility();
  const [cardWidth, setCardWidth] = useState<number>(Dimensions.get("window").width - spacing.lg * 2);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [userInteracting, setUserInteracting] = useState(false);

  const listRef = useRef<FlatList<string>>(null);
  const progressAnim = useRef(new RNAnimated.Value(0)).current;

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
      if (finished && isActive && !userInteracting) {
        setActiveIndex((prev) => {
          const next = (prev + 1) % images.length;
          if (cardWidth > 0) {
            listRef.current?.scrollToOffset({ offset: next * cardWidth, animated: true });
          }
          return next;
        });
      }
    });

    return () => {
      anim.stop();
    };
  }, [hasMultiple, isActive, userInteracting, activeIndex, images.length, cardWidth, progressAnim]);

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (cardWidth <= 0) return;
    const offset = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offset / cardWidth);
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
          const w = e.nativeEvent.layout.width;
          if (w > 0) setCardWidth(w);
        }}
      >
        <FlatList
          ref={listRef}
          data={images}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => `${s.id}-img-${i}`}
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
            onMomentumScrollEnd(e);
            setPagerScrollEnabled(true);
          }}
          renderItem={({ item }) => (
            <View style={{ width: cardWidth, height: 190 }}>
              <Image
                source={{ uri: mediaUri(item) }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
              />
            </View>
          )}
        />

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
            <Ionicons
              name={isSaved ? "bookmark" : "bookmark-outline"}
              size={22}
              color={isSaved ? colors.brandPrimary : colors.onSurfaceInverse}
            />
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
                return (
                  <View key={i} style={st.dotTrack}>
                    {isCurrent ? (
                      <RNAnimated.View
                        style={[
                          st.dotFill,
                          {
                            width: progressAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ["0%", "100%"],
                            }),
                          },
                        ]}
                      />
                    ) : i < activeIndex ? (
                      <View style={[st.dotFill, { width: "100%" }]} />
                    ) : null}
                  </View>
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
            {s.name}
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
          <Text style={st.metaText} numberOfLines={1}>{s.address || "Nearby"}</Text>
        </View>

        {/* Cuisine & Business / FSSAI type */}
        <Text style={st.fullCardCuisine} numberOfLines={1}>
          {s.cuisine || s.category}
        </Text>
        <Text style={st.fullCardType}>
          {s.business_type === "cloud_kitchen"
            ? "Cloud kitchen"
            : s.category === "grocery"
            ? "Grocery store"
            : "Restaurant"}
          {s.fssai_status === "verified" ? "  ·  FSSAI verified" : ""}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, alignItems: "center" },
  rowImg: { width: 108, height: 116, borderRadius: radius.md, backgroundColor: c.surfaceTertiary },
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
  tileImg: { width: 150, height: 150, borderRadius: radius.md, backgroundColor: c.surfaceTertiary },
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
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
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
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.32)",
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
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  dotTrack: {
    width: 14,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.35)",
    overflow: "hidden",
  },
  dotFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 2,
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
