import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { STATUS_LABEL, when } from "@/src/format";
import { Batch } from "@/src/partner";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { EmptyState, Header, Ionicons, Loader } from "@/src/ui";

export default function BatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ["seller-batches"], queryFn: () => api<Batch[]>("/seller/community-batches"), refetchInterval: 10000 });
  if (q.isLoading) return <Loader />;
  const b = q.data?.find((x) => x.basket_id === id);
  if (!b) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="Community batch" /><EmptyState icon="checkmark-done" title="All packages handed over" body="Nothing left to pack for this basket." /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <Header title={b.community_name} subtitle={`${b.packages.length} flats · ${b.ready_count} ready${b.scheduled_for ? ` · ${when(b.scheduled_for)}` : ""}`} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <View testID="batch-pick-list" style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
          <Text style={{ fontWeight: "800", color: colors.onSurface, fontSize: font.base + 1 }}>Consolidated pick list</Text>
          <Text style={{ color: colors.muted, fontSize: font.sm }}>Pick these together, then pack each flat separately below.</Text>
          {b.items_total.map((i) => (
            <View key={i.name} style={{ flexDirection: "row", paddingVertical: 2 }}>
              <Text style={{ flex: 1, color: colors.onSurface }}>{i.name}</Text>
              <Text style={{ fontWeight: "800", color: colors.onSurface }}>× {i.qty}</Text>
            </View>
          ))}
        </View>
        <Text style={{ fontWeight: "800", color: colors.onSurface, fontSize: font.lg }}>Flat packages</Text>
        {b.packages.map((p) => {
          const packed = p.packed.filter(Boolean).length;
          const ready = p.status === "ready_for_pickup";
          return (
            <Pressable key={p.id} testID={`batch-package-${p.flat}`} onPress={() => router.push(`/partner/order/${p.id}`)}
              style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1.5, borderColor: ready ? colors.success : colors.border, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View style={{ width: 56, height: 56, borderRadius: radius.md, backgroundColor: ready ? colors.pastelMint : colors.pastelSky, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontWeight: "900", color: ready ? colors.onPastelMint : colors.onPastelSky }}>{p.flat}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "800", color: colors.onSurface }}>{p.package_id} · {p.order_no}</Text>
                <Text style={{ color: colors.muted, fontSize: font.sm }} numberOfLines={1}>{p.items.map((i) => `${i.qty} × ${i.name}`).join(", ")}</Text>
                <Text style={{ color: ready ? colors.success : colors.brandPrimary, fontWeight: "700", fontSize: font.sm }}>{STATUS_LABEL[p.status]} · {packed}/{p.items.length} packed</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
