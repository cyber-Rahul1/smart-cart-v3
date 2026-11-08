import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { rupee } from "@/src/format";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Order } from "@/src/types";
import { Button, ErrorState, Header, IconName, Ionicons, Loader, useToast } from "@/src/ui";

type Methods = { online: boolean; online_mode: "demo" | "unavailable"; cod: boolean; cod_limit: number };
type Method = "online" | "cod";

/** Checkout for any pending order (route id = order id): demo online payment in preview, or cash on delivery. */
export default function Pay() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const { refresh } = useAuth();
  const [busy, setBusy] = useState<"success" | "failure" | "cod" | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<Method | null>(null);
  const q = useQuery({ queryKey: ["order", id], queryFn: () => api<Order>(`/orders/${id}`) });
  const m = useQuery({ queryKey: ["pay-methods"], queryFn: () => api<Methods>("/payments/methods") });

  const done = async (msg: string) => {
    await Promise.all([qc.invalidateQueries({ queryKey: ["order", id] }), qc.invalidateQueries({ queryKey: ["orders"] })]);
    refresh();
    toast(msg);
    router.replace(`/orders/${id}`);
  };

  const payOnline = async (outcome: "success" | "failure") => {
    setBusy(outcome);
    try {
      const p = await api<{ id: string }>("/payments/initiate", { method: "POST", body: { order_id: id } });
      await api(`/payments/${p.id}/demo-complete`, { method: "POST", body: { outcome } });
      await done("Payment successful · Order confirmed");
    } catch (e: any) {
      setFailed(true);
      toast(e.message, "err");
      qc.invalidateQueries({ queryKey: ["order", id] });
    } finally {
      setBusy(null);
    }
  };

  const payCod = async () => {
    setBusy("cod");
    try {
      await api("/payments/cod", { method: "POST", body: { order_id: id } });
      await done("Order confirmed · Pay cash on delivery");
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(null);
    }
  };

  if (q.isLoading || m.isLoading) return <Loader />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  const o = q.data!;
  const methods = m.data;
  const total = o.bill.total;
  const codOk = !!methods?.cod && total <= (methods?.cod_limit ?? 0);
  const method: Method | null = picked ?? (methods?.online ? "online" : codOk ? "cod" : null);

  if (o.status !== "pending_payment") {
    return (
      <View style={s.root}>
        <Header title="Payment" subtitle={`${o.seller_name} · ${o.order_no}`} />
        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          <Text testID="pay-already-done" style={s.title}>{o.status === "cancelled" ? "This order was cancelled." : "This order is already confirmed."}</Text>
          <Button testID="pay-view-order" title="View order" onPress={() => router.replace(`/orders/${id}`)} />
        </View>
      </View>
    );
  }

  const Option = ({ value, icon, title, sub, disabled }: { value: Method; icon: IconName; title: string; sub: string; disabled?: boolean }) => (
    <Pressable testID={`pay-method-${value}`} disabled={disabled} onPress={() => setPicked(value)}
      style={[s.option, method === value && !disabled && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }, disabled && { opacity: 0.5 }]}>
      <Ionicons name={icon} size={24} color={colors.brandPrimary} />
      <View style={{ flex: 1 }}>
        <Text style={s.optTitle}>{title}</Text>
        <Text style={s.sub}>{sub}</Text>
      </View>
      <Ionicons name={method === value && !disabled ? "radio-button-on" : "radio-button-off"} size={22} color={method === value && !disabled ? colors.brandPrimary : colors.borderStrong} />
    </Pressable>
  );

  return (
    <View style={s.root}>
      <Header title="Payment" subtitle={`${o.seller_name} · ${o.order_no}`} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
        <View style={{ alignItems: "center", paddingVertical: spacing.lg, gap: spacing.sm }}>
          <Text style={{ color: colors.muted, fontWeight: "600" }}>Amount to pay</Text>
          <Text testID="pay-amount" style={{ fontSize: 44, fontWeight: "900", color: colors.onSurface }}>{rupee(total)}</Text>
          {failed ? <Text testID="pay-failed-message" style={{ color: colors.error, fontWeight: "700", textAlign: "center" }}>Payment failed. Your order is NOT paid. Try again or choose cash on delivery.</Text> : null}
        </View>
        <Text style={s.title}>Choose how to pay</Text>
        <Option value="online" icon="card-outline" title="Pay online" disabled={!methods?.online}
          sub={methods?.online ? "UPI, cards & wallets" : "Coming soon"} />
        <Option value="cod" icon="cash-outline" title="Cash on delivery" disabled={!codOk}
          sub={codOk ? "Pay the rider in cash when your order arrives" : `Available for orders up to ${rupee(methods?.cod_limit)}`} />
        {method === "online" && methods?.online_mode === "demo" ? (
          <View testID="pay-demo-banner" style={s.demo}>
            <Ionicons name="flask-outline" size={18} color={colors.onPastelLemon} />
            <Text style={s.demoText}>Preview only — demo payment, no real money moves. The live app shows online payment once a payment gateway is connected.</Text>
          </View>
        ) : null}
      </ScrollView>
      <View style={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
        {method === "cod" ? (
          <Button testID="pay-cod-button" icon="cash-outline" title={`Place order · pay ${rupee(total)} in cash`} loading={busy === "cod"} disabled={!!busy} onPress={payCod} />
        ) : method === "online" ? (
          <>
            <Button testID="pay-success-button" icon="card-outline" title={`Pay ${rupee(total)}`} loading={busy === "success"} disabled={!!busy} onPress={() => payOnline("success")} />
            <Button testID="pay-fail-button" variant="ghost" title="Simulate payment failure" loading={busy === "failure"} disabled={!!busy} onPress={() => payOnline("failure")} />
          </>
        ) : <Text style={s.sub}>No payment method is available for this order.</Text>}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  title: { fontWeight: "800", color: c.onSurface, fontSize: font.lg },
  sub: { color: c.muted, fontSize: font.sm + 1 },
  option: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1.5, borderColor: c.border, minHeight: 64 },
  optTitle: { fontWeight: "800", color: c.onSurface, fontSize: font.base + 1 },
  demo: { backgroundColor: c.pastelLemon, borderRadius: radius.md, padding: spacing.md, flexDirection: "row", gap: spacing.sm },
  demoText: { color: c.onPastelLemon, flex: 1, fontWeight: "600", fontSize: font.sm + 1 },
}));
