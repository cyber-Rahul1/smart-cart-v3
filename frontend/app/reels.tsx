import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { mediaUri } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { AppImage, ErrorState, Ionicons, Loader } from "@/src/ui";

type Reel = { id: string; seller_id: string; seller_name: string; seller_image: string; title: string; media_url: string; sponsored: boolean; likes: number; trending?: boolean };

export default function ReelsScreen() {
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [h, setH] = useState(winH);
  const s = useStyles();
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ["reels"], queryFn: () => api<Reel[]>("/reels") });
  const bottomChrome = insets.bottom > 0 ? insets.bottom + 16 : 24;

  // Determine which reels are "Trending" (e.g. top liked reels above threshold or marked trending)
  const reelsList = q.data || [];
  const maxLikes = Math.max(...reelsList.map((r) => r.likes), 0);
  const isReelTrending = (item: Reel) => {
    if (item.trending) return true;
    if (reelsList.length <= 1) return false;
    return item.likes >= 168 || (maxLikes > 0 && item.likes === maxLikes);
  };

  return (
    <View style={s.root} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      {q.isLoading ? <Loader /> : q.isError ? <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} /> : (
        <FlatList
          testID="reels-feed"
          data={q.data}
          keyExtractor={(r) => r.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: h, offset: h * i, index: i })}
          renderItem={({ item }) => {
            const showTrendingBadge = isReelTrending(item);
            return (
              <View style={{ height: h }}>
                <Image source={{ uri: item.media_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
                <LinearGradient colors={["rgba(0,0,0,0.55)", "transparent", "rgba(0,0,0,0.85)"]} style={StyleSheet.absoluteFill} />
                
                {/* Header row with Back button & Badges */}
                <View style={[s.top, { top: insets.top + spacing.sm }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Pressable
                      testID="reels-back-button"
                      onPress={() => router.back()}
                      hitSlop={12}
                      style={({ pressed }) => [
                        s.backBtn,
                        pressed && { opacity: 0.75, transform: [{ scale: 0.95 }] },
                      ]}
                    >
                      <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
                    </Pressable>
                    <Text style={s.topHeaderTitle}>Bites</Text>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    {showTrendingBadge ? (
                      <View style={s.trendingBadge}>
                        <Ionicons name="flame" size={13} color="#FFFFFF" />
                        <Text style={s.trendingBadgeText}>Trending</Text>
                      </View>
                    ) : null}
                    {item.sponsored ? (
                      <View testID={`reel-sponsored-${item.id}`} style={s.sp}>
                        <Text style={s.spText}>Sponsored</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* Right side interaction buttons */}
                <View style={[s.side, { bottom: bottomChrome + 130 }]}>
                  <Pressable testID={`reel-like-${item.id}`} onPress={() => setLiked((l) => ({ ...l, [item.id]: !l[item.id] }))} style={s.sideBtn}>
                    <Ionicons name={liked[item.id] ? "heart" : "heart-outline"} size={30} color={liked[item.id] ? colors.error : colors.onSurfaceInverse} />
                    <Text style={s.sideText}>{item.likes + (liked[item.id] ? 1 : 0)}</Text>
                  </Pressable>
                  <Pressable testID={`reel-store-${item.id}`} onPress={() => router.push(`/seller/${item.seller_id}`)} style={s.sideBtn}>
                    <Ionicons name="storefront-outline" size={28} color={colors.onSurfaceInverse} />
                    <Text style={s.sideText}>Shop</Text>
                  </Pressable>
                </View>

                {/* Bottom info section */}
                <View style={[s.bottom, { bottom: bottomChrome + spacing.md }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <AppImage source={{ uri: mediaUri(item.seller_image) }} fallbackType="shop" style={s.avatar} />
                    <Text style={s.seller}>{item.seller_name}</Text>
                  </View>
                  <Text style={s.title}>{item.title}</Text>
                  <Pressable testID={`reel-view-menu-${item.id}`} onPress={() => router.push(`/seller/${item.seller_id}`)} style={s.cta}>
                    <Ionicons name="restaurant-outline" size={18} color={colors.onBrandPrimary} />
                    <Text style={s.ctaText}>View menu & order</Text>
                  </Pressable>
                  <Text style={s.note}>Video reels arrive with the seller app (next milestone)</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceInverse },
  top: { position: "absolute", left: spacing.lg, right: spacing.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "center", zIndex: 10 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  topHeaderTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  trendingBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: c.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 4 },
  trendingBadgeText: { color: "#FFFFFF", fontWeight: "800", fontSize: 11, letterSpacing: 0.2 },
  sp: { backgroundColor: c.warning, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  spText: { color: c.onWarning, fontWeight: "800", fontSize: font.sm },
  side: { position: "absolute", right: spacing.lg, gap: spacing.xl, alignItems: "center", zIndex: 10 },
  sideBtn: { alignItems: "center", minWidth: 44, gap: 2 },
  sideText: { color: c.onSurfaceInverse, fontWeight: "700", fontSize: font.sm },
  bottom: { position: "absolute", left: spacing.lg, right: 80, gap: spacing.sm, zIndex: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: c.onSurfaceInverse },
  seller: { color: c.onSurfaceInverse, fontWeight: "800", fontSize: font.lg },
  title: { color: c.onSurfaceInverse, fontSize: font.base + 1, lineHeight: 20 },
  cta: { flexDirection: "row", gap: spacing.sm, alignItems: "center", alignSelf: "flex-start", backgroundColor: c.brandPrimary, borderRadius: radius.pill,
    paddingHorizontal: spacing.lg, height: 44 },
  ctaText: { color: c.onBrandPrimary, fontWeight: "800" },
  note: { color: c.onSurfaceInverse, opacity: 0.7, fontSize: 11 },
}));
