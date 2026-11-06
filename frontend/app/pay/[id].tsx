import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { rupee } from "@/src/format";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { Order } from "@/src/types";
import { Button, Header, Ionicons, Loader, useToast } from "@/src/ui";

export default function Pay() {
  const { id, orderId } = useLocalSearchParams<{ id: string; orderId: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const { refresh } = useAuth();
  const [busy, setBusy] = useState<"success" | "failure" | null>(null);
  const [failed, setFailed] = useState(false);
  const q = useQuery({ queryKey: ["order", orderId], queryFn: () => api<Order>(`/orders/${orderId}`) });

  const complete = async (outcome: "success" | "failure") => {
    setBusy(outcome);
    try {
      await api(`/payments/${id}/demo-complete`, { method: "POST", body: { outcome } });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      refresh();
      toast("Payment successful · Order confirmed");
      router.replace(`/orders/${orderId}`);
    } catch (e: any) {
      setFailed(true);
      toast(e.message, "err");
      qc.invalidateQueries({ queryKey: ["order", orderId] });
    } finally {
      setBusy(null);
    }
  };

  if (q.isLoading) return <Loader />;
  const o = q.data;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Payment" subtitle={o ? `${o.seller_name} · ${o.order_no}` : undefined} />
      <View style={{ flex: 1, padding: spacing.xl, gap: spacing.lg }}>
        <View testID="pay-demo-banner" style={{ backgroundColor: colors.pastelLemon, borderRadius: radius.md, padding: spacing.md, flexDirection: "row", gap: spacing.sm }}>
          <Ionicons name="flask-outline" size={18} color={colors.onPastelLemon} />
          <Text style={{ color: colors.onPastelLemon, flex: 1, fontWeight: "600", fontSize: font.sm + 1 }}>
            Demo payment mode — no real money moves. The server verifies a signed provider response before confirming your order (Razorpay plugs in later).
          </Text>
        </View>
        <View style={{ alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm }}>
          <Text style={{ color: colors.muted, fontWeight: "600" }}>Amount to pay</Text>
          <Text testID="pay-amount" style={{ fontSize: 44, fontWeight: "900", color: colors.onSurface }}>{rupee(o?.bill.total)}</Text>
          {failed ? <Text testID="pay-failed-message" style={{ color: colors.error, fontWeight: "700", textAlign: "center" }}>Payment failed. Your order is NOT paid. Try again.</Text> : null}
        </View>
      </View>
      <View style={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, gap: spacing.sm }}>
        <Button testID="pay-success-button" icon="card-outline" title={`Pay ${rupee(o?.bill.total)}`} loading={busy === "success"} disabled={!!busy} onPress={() => complete("success")} />
        <Button testID="pay-fail-button" variant="ghost" title="Simulate payment failure" loading={busy === "failure"} disabled={!!busy} onPress={() => complete("failure")} />
      </View>
    </View>
  );
}
