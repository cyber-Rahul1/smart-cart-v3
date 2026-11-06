import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { rupee, STATUS_LABEL, when } from "@/src/format";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { Order } from "@/src/types";
import { EmptyState, ErrorState, Header, Loader } from "@/src/ui";

export default function Orders() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ["orders"], queryFn: () => api<Order[]>("/orders") });
  const kindLabel = (o: Order) => (o.kind === "group" ? `Group · ${o.group_name}` : o.kind === "community_flat" ? `Flat ${o.flat} · ${o.community_name}` : "Individual");

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header title="Your orders" />
      {q.isLoading ? <Loader /> : q.isError ? <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} /> : (
        <FlatList
          testID="orders-list"
          data={q.data}
          keyExtractor={(o) => o.id}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}
          ListEmptyComponent={<EmptyState testID="orders-empty" icon="receipt-outline" title="No orders yet" body="Your food, grocery, group and community orders show up here." action="Start shopping" onAction={() => router.replace("/(tabs)")} />}
          renderItem={({ item: o }) => (
            <Pressable testID={`order-card-${o.id}`} onPress={() => router.push(`/orders/${o.id}`)}
              style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm }}>
              <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
                <Image source={{ uri: o.seller_image }} style={{ width: 48, height: 48, borderRadius: radius.md }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "800", color: colors.onSurface, fontSize: font.base + 1 }}>{o.seller_name}</Text>
                  <Text style={{ color: colors.muted, fontSize: font.sm }}>{o.order_no} · {kindLabel(o)}</Text>
                </View>
                <View style={{ paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm,
                  backgroundColor: o.status === "delivered" ? colors.pastelMint : o.status === "cancelled" ? colors.pastelRose : colors.brandTertiary }}>
                  <Text testID={`order-status-${o.id}`} style={{ fontWeight: "800", fontSize: font.sm,
                    color: o.status === "delivered" ? colors.onPastelMint : o.status === "cancelled" ? colors.onPastelRose : colors.brandPrimary }}>{STATUS_LABEL[o.status] ?? o.status}</Text>
                </View>
              </View>
              <Text style={{ color: colors.onSurfaceSecondary }} numberOfLines={1}>{o.items.map((i) => `${i.qty} × ${i.name}`).join(", ")}</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.muted, fontSize: font.sm }}>{when(o.created_at)}{o.scheduled_for ? ` · Scheduled ${when(o.scheduled_for)}` : ""}</Text>
                <Text style={{ fontWeight: "800", color: colors.onSurface }}>{rupee(o.bill.total)}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
