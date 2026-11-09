import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { SellerRow, SellerTile } from "@/src/components/seller-card";
import { usesNativeTabs } from "@/src/navigation";
import { font, makeStyles, radius, spacing, ThemeColors, useTheme } from "@/src/theme";
import { Address, Seller } from "@/src/types";
import { ErrorState, IconName, Ionicons, Loader, SectionTitle } from "@/src/ui";

type Home = { trending: Seller[]; new_shops: Seller[]; nearby: Seller[]; recommended: Seller[]; offers: { code: string; description: string }[] };

const TILES: { key: string; label: string; icon: IconName; bg: keyof ThemeColors; fg: keyof ThemeColors; href: string }[] = [
  { key: "food", label: "Food", icon: "fast-food-outline", bg: "brandTertiary", fg: "onBrandTertiary", href: "/listing/food" },
  { key: "grocery", label: "Groceries", icon: "basket-outline", bg: "pastelMint", fg: "onPastelMint", href: "/listing/grocery" },
  { key: "new", label: "Discover", icon: "sparkles-outline", bg: "pastelLemon", fg: "onPastelLemon", href: "/listing/new" },
  { key: "group", label: "Group Orders", icon: "people-outline", bg: "pastelLilac", fg: "onPastelLilac", href: "/groups" },
  { key: "community", label: "Apartment", icon: "business-outline", bg: "pastelSky", fg: "onPastelSky", href: "/community" },
  { key: "reels", label: "Trending", icon: "play-circle-outline", bg: "pastelRose", fg: "onPastelRose", href: "/(tabs)/reels" },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["home"], queryFn: () => api<Home>("/home") });
  const addr = useQuery({ queryKey: ["addresses"], queryFn: () => api<Address[]>("/addresses") });
  const notif = useQuery({ queryKey: ["notifications"], queryFn: () => api<{ unread: number }>("/notifications") });
  const def = addr.data?.find((a) => a.is_default);
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={s.locRow}>
          <Pressable testID="home-location-selector" style={{ flex: 1 }} onPress={() => router.push("/addresses")}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="location" size={20} color={colors.brandPrimary} />
              <Text style={s.locLabel}>{def?.label ?? "Add address"}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.onSurface} />
            </View>
            <Text style={s.locLine} numberOfLines={1}>{def?.line ?? "Set your delivery location to see what's nearby"}</Text>
          </Pressable>
          <Pressable testID="home-notifications-button" onPress={() => router.push("/notifications")} style={s.bell}>
            <Ionicons name="notifications-outline" size={22} color={colors.onSurface} />
            {notif.data?.unread ? <View style={s.dot}><Text style={s.dotText}>{Math.min(notif.data.unread, 9)}</Text></View> : null}
          </Pressable>
        </View>
        <Pressable testID="home-search-bar" onPress={() => router.push("/search")} style={s.search}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <Text style={s.searchText}>Search biryani, milk, shops…</Text>
        </Pressable>
      </View>

      {q.isLoading ? <Loader /> : q.isError ? <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} /> : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: bottomChrome + spacing.xl }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); notif.refetch(); }} tintColor={colors.brandPrimary} />}
        >
          <Text style={s.hello}>Hi {user?.name?.split(" ")[0]}, what are we ordering?</Text>
          <View style={s.grid}>
            {TILES.map((t) => (
              <View key={t.key} style={s.tileWrap}>
                <Pressable testID={`home-tile-${t.key}`} onPress={() => router.push(t.href as any)}
                  style={({ pressed }) => [s.tile, { backgroundColor: colors[t.bg] as string }, pressed && { transform: [{ scale: 0.96 }] }]}>
                  <Ionicons name={t.icon} size={28} color={colors[t.fg] as string} />
                  <Text style={[s.tileLabel, { color: colors[t.fg] as string }]}>{t.label}</Text>
                </Pressable>
              </View>
            ))}
          </View>

          <Pressable testID="home-schedule-entry" onPress={() => router.push("/listing/food?schedule=1")} style={s.schedule}>
            <View style={s.scheduleIcon}><Ionicons name="time-outline" size={22} color={colors.onPastelLilac} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.schedTitle}>Schedule for later</Text>
              <Text style={s.schedSub}>Dinner at 8, groceries tomorrow morning — pick a slot at checkout</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>

          <SectionTitle title="Offers for you" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
            {q.data!.offers.map((o, i) => (
              <View key={o.code} testID={`home-offer-${o.code}`} style={[s.offer, { backgroundColor: [colors.brandTertiary, colors.pastelMint, colors.pastelLilac][i % 3] }]}>
                <Ionicons name="pricetag" size={18} color={colors.brandPrimary} />
                <Text style={s.offerCode}>{o.code}</Text>
                <Text style={s.offerDesc}>{o.description}</Text>
              </View>
            ))}
          </ScrollView>

          <Pressable testID="home-group-banner" onPress={() => router.push("/groups")} style={s.banner}>
            <Image source={{ uri: "https://images.unsplash.com/photo-1547573854-74d2a71d0826?w=900&q=70" }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient colors={["rgba(0,0,0,0.65)", "rgba(0,0,0,0.05)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.bannerInner}>
              <Text style={s.bannerTitle}>Roommates?{"\n"}One cart, everyone's cravings.</Text>
              <View style={s.bannerCta}><Text style={s.bannerCtaText}>Start a group order</Text></View>
            </LinearGradient>
          </Pressable>

          <SectionTitle title="Trending near you" action="See all" testID="home-trending-see-all" onAction={() => router.push("/listing/food")} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
            {q.data!.trending.map((sl, i) => <SellerTile key={sl.id} s={sl} rank={i + 1} testID={`home-trending-${sl.id}`} />)}
          </ScrollView>

          <SectionTitle title="Newly opened" action="See all" testID="home-new-see-all" onAction={() => router.push("/listing/new")} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
            {q.data!.new_shops.map((sl) => <SellerTile key={sl.id} s={sl} testID={`home-new-${sl.id}`} />)}
          </ScrollView>

          <Pressable testID="home-community-banner" onPress={() => router.push("/community")} style={[s.schedule, { backgroundColor: colors.pastelSky, borderColor: colors.pastelSky }]}>
            <View style={[s.scheduleIcon, { backgroundColor: colors.surface }]}><Ionicons name="business" size={22} color={colors.onPastelSky} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.schedTitle}>Apartment community basket</Text>
              <Text style={s.schedSub}>Neighbours order together, each flat gets its own bill & package</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.onPastelSky} />
          </Pressable>

          <SectionTitle title="Recommended for you" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
            {q.data!.recommended.map((sl) => <SellerTile key={sl.id} s={sl} testID={`home-rec-${sl.id}`} />)}
          </ScrollView>

          <SectionTitle title="All shops nearby" />
          {q.data!.nearby.map((sl) => <SellerRow key={sl.id} s={sl} testID={`home-nearby-${sl.id}`} />)}
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: c.surface, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
  locRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  locLabel: { fontSize: font.lg + 1, fontWeight: "800", color: c.onSurface },
  locLine: { fontSize: font.sm + 1, color: c.muted, marginTop: 2, marginLeft: 24 },
  bell: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  dotText: { color: c.onBrandPrimary, fontSize: 10, fontWeight: "900" },
  search: { height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, flexDirection: "row", alignItems: "center",
    gap: spacing.sm, paddingHorizontal: spacing.lg, shadowColor: c.onSurface, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  searchText: { color: c.muted, fontSize: font.base + 1 },
  hello: { fontSize: font.xl, fontWeight: "800", color: c.onSurface, paddingHorizontal: spacing.lg, marginTop: spacing.lg, letterSpacing: -0.3 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.md, marginTop: spacing.md },
  tileWrap: { width: "33.33%", padding: spacing.xs },
  tile: { height: 96, borderRadius: radius.md, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  tileLabel: { fontSize: font.sm + 1, fontWeight: "800" },
  schedule: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border,
    flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surface },
  scheduleIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.pastelLilac, alignItems: "center", justifyContent: "center" },
  schedTitle: { fontWeight: "800", color: c.onSurface, fontSize: font.base + 1 },
  schedSub: { color: c.muted, fontSize: font.sm, marginTop: 2 },
  offer: { width: 200, padding: spacing.md, borderRadius: radius.md, gap: 4 },
  offerCode: { fontWeight: "900", color: c.onSurface, fontSize: font.lg, letterSpacing: 0.5 },
  offerDesc: { color: c.onSurfaceSecondary, fontSize: font.sm },
  banner: { marginHorizontal: spacing.lg, marginTop: spacing.xl, height: 150, borderRadius: radius.lg, overflow: "hidden", backgroundColor: c.surfaceTertiary },
  bannerInner: { flex: 1, padding: spacing.lg, justifyContent: "space-between" },
  bannerTitle: { color: c.onSurfaceInverse, fontWeight: "800", fontSize: font.lg + 2, lineHeight: 24 },
  bannerCta: { alignSelf: "flex-start", backgroundColor: c.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bannerCtaText: { color: c.onBrandPrimary, fontWeight: "800", fontSize: font.sm + 1 },
}));
