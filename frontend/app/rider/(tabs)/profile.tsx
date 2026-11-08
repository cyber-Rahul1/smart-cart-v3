import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { PartnerHeader } from "@/src/components/partner-header";
import { rupee, when } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { Rider, RiderJob } from "@/src/rider";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { BillRow, Button, Loader } from "@/src/ui";

export default function RiderProfile() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { signOut } = useAuth();
  const me = useQuery({ queryKey: ["rider-me"], queryFn: () => api<{ rider: Rider }>("/rider/me") });
  const h = useQuery({ queryKey: ["rider-history"], queryFn: () => api<{ count: number; earnings: number; items: RiderJob[] }>("/rider/history") });
  const r = me.data?.rider;
  if (!r) return <Loader />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <PartnerHeader title="Profile" subtitle={r.phone} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: (usesNativeTabs ? insets.bottom : 0) + spacing.xl }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border }}>
          <BillRow label="Status" value={r.verified ? "Verified" : r.approval_status === "rejected" ? "Rejected" : "Pending review"} testID="rider-profile-status" />
          <BillRow label="Vehicle" value={`${r.vehicle} ${r.vehicle_number}`} />
          <BillRow label="Licence" value={r.licence_number} />
          <BillRow label="Capacity" value={`${r.max_packages} packages · ${r.max_weight_kg} kg`} />
        </View>
        <View style={{ backgroundColor: colors.pastelMint, borderRadius: radius.md, padding: spacing.lg }}>
          <Text style={{ color: colors.onPastelMint, fontWeight: "700" }}>Delivered</Text>
          <Text testID="rider-history-count" style={{ color: colors.onPastelMint, fontSize: font.xxl, fontWeight: "900" }}>{h.data?.count ?? 0} · {rupee(h.data?.earnings)}</Text>
          <Text style={{ color: colors.onPastelMint, fontSize: font.sm }}>Earnings estimate from delivery fees (payouts not yet implemented)</Text>
        </View>
        {h.data?.items.slice(0, 20).map((j) => (
          <View key={j.id} style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: colors.onSurface }}>{j.order_no}{j.flat ? ` · Flat ${j.flat}` : ""}</Text>
            <Text style={{ color: colors.muted, fontSize: font.sm }}>{when(j.delivered_at)}</Text>
          </View>
        ))}
        <Text style={{ color: colors.muted, fontSize: font.sm }}>Live GPS tracking and in-app navigation arrive with native maps in a later milestone.</Text>
        <Button testID="rider-logout-button" variant="danger" icon="log-out-outline" title="Log out" onPress={async () => { await signOut(); router.replace("/login?mode=rider"); }} />
      </ScrollView>
    </View>
  );
}
