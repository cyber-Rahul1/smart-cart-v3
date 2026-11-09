import React, { useEffect, useMemo, useRef, useState } from "react";
import {
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
export function SellerFullCard({ s, testID }: { s: Seller; testID: string }) {
  const st = useStyles();
  const { colors } = useTheme();
  const [cardWidth, setCardWidth] = useState<number>(Dimensions.get("window").width - spacing.lg * 2);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);
  const [userInteracting, setUserInteracting] = useState(false);

  const listRef = useRef<FlatList<string>>(null);

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

  // Auto-scroll carousel every 3.5 seconds if multiple images and not actively swiping
  useEffect(() => {
    if (!hasMultiple || userInteracting) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % images.length;
        if (cardWidth > 0) {
          listRef.current?.scrollToOffset({ offset: next * cardWidth, animated: true });
        }
        return next;
      });
    }, 3500);

    return () => clearInterval(interval);
  }, [hasMultiple, images.length, cardWidth, userInteracting]);

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
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => `${s.id}-img-${i}`}
          onScrollBeginDrag={() => setUserInteracting(true)}
          onMomentumScrollEnd={onMomentumScrollEnd}
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
          colors={["rgba(0,0,0,0.45)", "transparent", "rgba(0,0,0,0.65)"]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Top Header Row on Image: Pagination Dots (center) + Heart & More icons (right) */}
        <View style={st.imageTopRow} pointerEvents="box-none">
          <View style={{ width: 60 }} />
          {hasMultiple ? (
            <View style={st.dotsContainer}>
              {images.map((_, i) => (
                <View
                  key={i}
                  style={[
                    st.dot,
                    i === activeIndex ? st.dotActive : st.dotInactive,
                  ]}
                />
              ))}
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          <View style={st.topActionIcons}>
            <Pressable
              hitSlop={10}
              onPress={(e) => {
                e.stopPropagation();
                setIsFavorited((prev) => !prev);
              }}
              style={st.iconBtn}
            >
              <Ionicons
                name={isFavorited ? "heart" : "heart-outline"}
                size={22}
                color={isFavorited ? colors.error : colors.onSurfaceInverse}
              />
            </Pressable>
            <View style={st.iconBtn}>
              <Ionicons
                name="ellipsis-vertical"
                size={20}
                color={colors.onSurfaceInverse}
              />
            </View>
          </View>
        </View>

        {/* Bottom Bar on Image: Offer badge (bottom-left) + ETA pill (bottom-right) */}
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

          <View style={st.etaPill}>
            <Text style={st.etaText}>
              {s.eta_min ? `${s.eta_min} MINS` : "20-30 MINS"}
            </Text>
          </View>
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
    justifyContent: "space-between",
  },
  dotsContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  dot: {
    height: 5,
    borderRadius: 2.5,
  },
  dotActive: {
    width: 14,
    backgroundColor: c.onSurfaceInverse,
  },
  dotInactive: {
    width: 5,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  topActionIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  iconBtn: {
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.2)",
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
  etaPill: {
    backgroundColor: c.surface,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.sm,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  etaText: {
    color: c.onSurface,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
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
