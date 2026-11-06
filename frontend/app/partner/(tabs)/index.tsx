import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { PartnerHeader } from "@/src/components/partner-header";
import { rupee, STATUS_LABEL, when } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { Batch, KIND_LABEL, SellerOrder, Shop } from "@/src/partner";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Chip, ChipRow, EmptyState, ErrorState, Ionicons, Loader } from "@/src/ui";

const SEGS = [
  { key: "new", label: "New" }, { key: "active", label: "In progress" }, { key: "scheduled", label: "Scheduled" },
  { key: "community", label: "Community packing" }, { key: "done", label: "Completed" },
] as const;
type Seg = (typeof SEGS)[number]["key"];
type Summary = { today_orders: number; today_sales: number; today_payout: number; new: number; preparing: number; ready: number };

export default function PartnerOrders() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const [seg, setSeg] = useState<Seg>("new");
  const me = useQuery({ queryKey: ["seller-me"], queryFn: () => api<{ shop: Shop }>("/seller/me") });
  const sum = useQuery({ queryKey: ["seller-summary"], queryFn: () => api<Summary>("/seller/summary"), refetchInterval: 15000 });
  const list = useQuery({ queryKey: ["seller-orders", seg], queryFn: () => api<SellerOrder[]>(`/seller/orders?tab=${seg}`), enabled: seg !== "community", refetchInterval: 15000 });
  const batches = useQuery({ queryKey: ["seller-batches"], queryFn: () => api<Batch[]>("/seller/community-batches"), enabled: seg === "community", refetchInterval: 15000 });
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const shop = me.data?.shop;
  const active = seg === "community" ? batches : list;

  const refresh = () => { sum.refetch(); active.refetch(); };

  return (
    <View style={s.root}>
      <PartnerHeader title={shop?.name ?? "Orders"} subtitle={shop ? `${shop.open ? "Accepting orders" : "Closed"} · ${shop.approved ? "Live" : "Pending approval"}` : undefined}>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {[["New", sum.data?.new], ["Preparing", sum.data?.preparing], ["Ready", sum.data?.ready], ["Today", rupee(sum.data?.today_payout)]].map(([l, v]) => (
            <View key={l as string} style={s.stat} testID={`partner-stat-${String(l).toLowerCase()}`}>
              <Text style={s.statVal}>{v ?? 0}</Text>
              <Text style={s.statLabel}>{l === "Today" ? "Today payout" : l}</Text>
            </View>
          ))}
        </View>
      </PartnerHeader>
      {!shop?.approved && shop ? (
        <Pressable testID="partner-pending-banner" onPress={() => router.push("/partner/shop")} style={s.pending}>
          <Ionicons name="hourglass-outline" size={18} color={colors.onPastelLemon} />
          <Text style={{ flex: 1, color: colors.onPastelLemon, fontWeight: "600", fontSize: font.sm + 1 }}>Your shop is under review and hidden from customers. Open Shop tab for status.</Text>
        </Pressable>
      ) : null}
      <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
        <ChipRow>
          {SEGS.map((x) => <Chip key={x.key} testID={`partner-seg-${x.key}`} label={x.label} selected={seg === x.key} onPress={() => setSeg(x.key)} />)}
        </ChipRow>
      </View>
      {active.isLoading ? <Loader /> : active.isError ? <ErrorState message={(active.error as Error).message} onRetry={() => active.refetch()} /> : seg === "community" ? (
        <FlatList
          testID="partner-batches-list"
          data={batches.data}
          keyExtractor={(b) => b.basket_id}
          refreshControl={<RefreshControl refreshing={batches.isRefetching} onRefresh={refresh} tintColor={colors.brandPrimary} />}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: bottomChrome + spacing.xl }}
          ListEmptyComponent={<EmptyState testID="partner-batches-empty" icon="business-outline" title="No community orders" body="Apartment community baskets appear here with one package per flat." />}
          renderItem={({ item: b }) => (
            <Pressable testID={`partner-batch-${b.basket_id}`} onPress={() => router.push(`/partner/batch/${b.basket_id}`)} style={s.card}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View style={[s.icon, { backgroundColor: colors.pastelSky }]}><Ionicons name="business" size={20} color={colors.onPastelSky} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.title}>{b.community_name}</Text>
                  <Text style={s.sub}>{b.packages.length} flat packages · {b.ready_count} ready{b.scheduled_for ? ` · Deliver ${when(b.scheduled_for)}` : ""}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </View>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          testID="partner-orders-list"
          data={list.data}
          keyExtractor={(o) => o.id}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={refresh} tintColor={colors.brandPrimary} />}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: bottomChrome + spacing.xl }}
          ListEmptyComponent={<EmptyState testID="partner-orders-empty" icon="receipt-outline" title="Nothing here right now" body="New paid orders show up instantly. Pull down to refresh." />}
          renderItem={({ item: o }) => (
            <Pressable testID={`partner-order-${o.id}`} onPress={() => router.push(`/partner/order/${o.id}`)} style={s.card}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View style={[s.icon, { backgroundColor: o.kind === "community_flat" ? colors.pastelSky : o.kind === "group" ? colors.pastelLilac : colors.brandTertiary }]}>
                  <Ionicons name={o.kind === "community_flat" ? "business" : o.kind === "group" ? "people" : "person"} size={18}
                    color={o.kind === "community_flat" ? colors.onPastelSky : o.kind === "group" ? colors.onPastelLilac : colors.brandPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.title}>{o.order_no}</Text>
                  <Text style={s.sub}>{KIND_LABEL(o)}</Text>
                </View>
                <Text testID={`partner-order-status-${o.id}`} style={s.status}>{STATUS_LABEL[o.status]}</Text>
              </View>
              <Text style={{ color: colors.onSurfaceSecondary }} numberOfLines={2}>{o.items.map((i) => `${i.qty} × ${i.name}`).join(", ")}</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={s.sub}>{o.scheduled_for ? `Scheduled ${when(o.scheduled_for)}` : `Placed ${when(o.created_at)}`}</Text>
                <Text style={{ fontWeight: "800", color: colors.onSurface }}>{rupee(o.subtotal)}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  stat: { flex: 1, backgroundColor: c.inverseTint, borderRadius: radius.md, padding: spacing.sm },
  statVal: { color: c.onSurfaceInverse, fontWeight: "900", fontSize: font.lg },
  statLabel: { color: c.onSurfaceInverse, opacity: 0.7, fontSize: 11 },
  pending: { flexDirection: "row", gap: spacing.sm, alignItems: "center", backgroundColor: c.pastelLemon, padding: spacing.md },
  card: { backgroundColor: c.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: c.border, gap: spacing.sm },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title: { fontWeight: "800", color: c.onSurface, fontSize: font.base + 1 },
  sub: { color: c.muted, fontSize: font.sm },
  status: { fontWeight: "800", color: c.brandPrimary, fontSize: font.sm },
}));
