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
import { ErrorState, Ionicons, Loader } from "@/src/ui";

type Reel = { id: string; seller_id: string; seller_name: string; seller_image: string; title: string; media_url: string; sponsored: boolean; likes: number };

export default function Reels() {
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [h, setH] = useState(winH);
  const s = useStyles();
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ["reels"], queryFn: () => api<Reel[]>("/reels") });
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

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
          renderItem={({ item }) => (
            <View style={{ height: h }}>
              <Image source={{ uri: item.media_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
              <LinearGradient colors={["rgba(0,0,0,0.45)", "transparent", "rgba(0,0,0,0.75)"]} style={StyleSheet.absoluteFill} />
              <View style={[s.top, { top: insets.top + spacing.sm }]}>
                <Text style={s.topTitle}>Bites</Text>
                {item.sponsored ? <View testID={`reel-sponsored-${item.id}`} style={s.sp}><Text style={s.spText}>Sponsored</Text></View> : null}
              </View>
              <View style={[s.side, { bottom: bottomChrome + 140 }]}>
                <Pressable testID={`reel-like-${item.id}`} onPress={() => setLiked((l) => ({ ...l, [item.id]: !l[item.id] }))} style={s.sideBtn}>
                  <Ionicons name={liked[item.id] ? "heart" : "heart-outline"} size={30} color={liked[item.id] ? colors.error : colors.onSurfaceInverse} />
                  <Text style={s.sideText}>{item.likes + (liked[item.id] ? 1 : 0)}</Text>
                </Pressable>
                <Pressable testID={`reel-store-${item.id}`} onPress={() => router.push(`/seller/${item.seller_id}`)} style={s.sideBtn}>
                  <Ionicons name="storefront-outline" size={28} color={colors.onSurfaceInverse} />
                  <Text style={s.sideText}>Shop</Text>
                </Pressable>
              </View>
              <View style={[s.bottom, { bottom: bottomChrome + spacing.lg }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Image source={{ uri: mediaUri(item.seller_image) }} style={s.avatar} />
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
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceInverse },
  top: { position: "absolute", left: spacing.lg, right: spacing.lg, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  topTitle: { color: c.onSurfaceInverse, fontSize: font.xl, fontWeight: "800" },
  sp: { backgroundColor: c.warning, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  spText: { color: c.onWarning, fontWeight: "800", fontSize: font.sm },
  side: { position: "absolute", right: spacing.lg, gap: spacing.xl, alignItems: "center" },
  sideBtn: { alignItems: "center", minWidth: 44, gap: 2 },
  sideText: { color: c.onSurfaceInverse, fontWeight: "700", fontSize: font.sm },
  bottom: { position: "absolute", left: spacing.lg, right: 80, gap: spacing.sm },
  avatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: c.onSurfaceInverse },
  seller: { color: c.onSurfaceInverse, fontWeight: "800", fontSize: font.lg },
  title: { color: c.onSurfaceInverse, fontSize: font.base + 1, lineHeight: 20 },
  cta: { flexDirection: "row", gap: spacing.sm, alignItems: "center", alignSelf: "flex-start", backgroundColor: c.brandPrimary, borderRadius: radius.pill,
    paddingHorizontal: spacing.lg, height: 44 },
  ctaText: { color: c.onBrandPrimary, fontWeight: "800" },
  note: { color: c.onSurfaceInverse, opacity: 0.7, fontSize: 11 },
}));
