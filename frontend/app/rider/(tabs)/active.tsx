import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { PartnerHeader } from "@/src/components/partner-header";
import { STATUS_LABEL } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { RiderJob } from "@/src/rider";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { EmptyState, Ionicons, Loader } from "@/src/ui";

export default function RiderActive() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ["rider-active"], queryFn: () => api<RiderJob[]>("/rider/active"), refetchInterval: 10000 });
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <PartnerHeader title="My deliveries" subtitle={`${q.data?.length ?? 0} packages on you`} />
      {q.isLoading ? <Loader /> : (
        <FlatList
          testID="rider-active-list"
          data={q.data}
          keyExtractor={(j) => j.id}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={colors.brandPrimary} />}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: bottomChrome + spacing.xl }}
          ListEmptyComponent={<EmptyState testID="rider-active-empty" icon="cube-outline" title="No active deliveries" body="Accept a job from the Jobs tab." />}
          renderItem={({ item: j }) => (
            <Pressable testID={`rider-active-${j.id}`} onPress={() => router.push(`/rider/order/${j.id}`)}
              style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
              <View style={{ width: 52, height: 52, borderRadius: radius.md, backgroundColor: j.flat ? colors.pastelSky : colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
                {j.flat ? <Text style={{ fontWeight: "900", color: colors.onPastelSky }}>{j.flat}</Text> : <Ionicons name="cube" size={22} color={colors.brandPrimary} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "800", color: colors.onSurface }}>{j.order_no}{j.package_id ? ` · ${j.package_id}` : ""}</Text>
                <Text style={{ color: colors.muted, fontSize: font.sm }} numberOfLines={1}>{j.status === "ready_for_pickup" ? `Pick up at ${j.pickup.name}` : `Drop: ${j.drop.address}`}</Text>
                <Text style={{ color: colors.brandPrimary, fontWeight: "700", fontSize: font.sm }}>{STATUS_LABEL[j.status]}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
