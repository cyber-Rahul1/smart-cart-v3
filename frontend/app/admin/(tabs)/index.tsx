import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { PartnerHeader } from "@/src/components/partner-header";
import { rupee } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { Button, Ionicons, Loader } from "@/src/ui";

type O = Record<string, number>;
const CARDS: [string, string, (v: number) => string][] = [
  ["orders", "Paid orders", String], ["gmv", "Gross order value", rupee], ["aov", "Avg order value", rupee], ["commission", "Commission earned", rupee],
  ["delivery_cost", "Delivery cost", rupee], ["community_orders", "Flat orders", String], ["group_orders", "Group orders", String],
  ["customers", "Customers", String], ["sellers_live", "Live shops", String], ["riders_verified", "Verified riders", String], ["refunds", "Refunds", String],
];

export default function AdminOverview() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { signOut } = useAuth();
  const q = useQuery({ queryKey: ["admin-overview"], queryFn: () => api<O>("/admin/overview") });
  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <PartnerHeader title="Admin" subtitle="Platform overview" />
      {q.isLoading ? <Loader /> : (
        <ScrollView refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); }} tintColor={colors.brandPrimary} />}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: (usesNativeTabs ? insets.bottom : 0) + spacing.xl }}>
          {[["sellers_pending", "shops waiting for review", "/admin/shops"], ["riders_pending", "riders waiting for verification", "/admin/riders"]].map(([k, l, href]) => (
            <Pressable key={k} testID={`admin-pending-${k}`} onPress={() => router.push(href as any)}
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.md, backgroundColor: q.data?.[k] ? colors.pastelLemon : colors.pastelMint }}>
              <Text style={{ fontSize: font.xxl, fontWeight: "900", color: colors.onSurface }}>{q.data?.[k] ?? 0}</Text>
              <Text style={{ flex: 1, fontWeight: "700", color: colors.onSurface }}>{l}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ))}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
            {CARDS.map(([k, l, fmt]) => (
              <View key={k} testID={`admin-metric-${k}`} style={{ width: "47%", backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.muted, fontSize: font.sm }}>{l}</Text>
                <Text style={{ color: colors.onSurface, fontWeight: "900", fontSize: font.xl }}>{fmt(q.data?.[k] ?? 0)}</Text>
              </View>
            ))}
          </View>
          <Button testID="admin-logout-button" variant="danger" icon="log-out-outline" title="Log out" onPress={async () => { await signOut(); router.replace("/login?mode=admin"); }} />
        </ScrollView>
      )}
    </View>
  );
}
