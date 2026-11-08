import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

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
}));
