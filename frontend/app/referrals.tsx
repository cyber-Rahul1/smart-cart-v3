import { useQuery } from "@tanstack/react-query";
import { ScrollView, Share, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { when } from "@/src/format";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { Button, Header, Loader } from "@/src/ui";

type R = { code: string; credits: number; referrals: { id: string; referee_name: string; status: string; created_at: string }[] };

export default function Referrals() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ["referrals"], queryFn: () => api<R>("/referrals") });
  if (q.isLoading) return <Loader />;
  const d = q.data!;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Refer & earn" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <View style={{ backgroundColor: colors.brandTertiary, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm, alignItems: "center" }}>
          <Text style={{ color: colors.onSurfaceSecondary, fontWeight: "600" }}>Your referral code</Text>
          <Text testID="referral-code" style={{ fontSize: 32, fontWeight: "900", color: colors.brandPrimary, letterSpacing: 2 }}>{d.code}</Text>
          <Text style={{ color: colors.onSurfaceSecondary, textAlign: "center" }}>When a friend signs up with your code and completes their first order (₹149+), you get a free-delivery credit.</Text>
          <Text testID="referral-credits" style={{ fontWeight: "800", color: colors.onSurface, fontSize: font.lg }}>{d.credits} credits available</Text>
          <Button testID="referral-share-button" icon="share-social-outline" title="Share code" style={{ alignSelf: "stretch" }}
            onPress={() => Share.share({ message: `Order groceries & food together on GathrCart! Use my code ${d.code} when you sign up.` })} />
        </View>
        <Text style={{ fontWeight: "800", fontSize: font.lg, color: colors.onSurface }}>Referral history</Text>
        {!d.referrals.length ? <Text style={{ color: colors.muted }}>No referrals yet — share your code with roommates and neighbours.</Text> : null}
        {d.referrals.map((r) => (
          <View key={r.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
            <View>
              <Text style={{ fontWeight: "700", color: colors.onSurface }}>{r.referee_name}</Text>
              <Text style={{ color: colors.muted, fontSize: font.sm }}>{when(r.created_at)}</Text>
            </View>
            <Text style={{ fontWeight: "800", color: r.status === "rewarded" ? colors.success : colors.warning }}>{r.status === "rewarded" ? "Rewarded" : "Pending first order"}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
