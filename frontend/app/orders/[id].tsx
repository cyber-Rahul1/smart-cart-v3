import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { LiveTrack } from "@/src/components/live-track";
import { rupee, STATUS_LABEL, when } from "@/src/format";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Line, Order } from "@/src/types";
import { BillRow, Button, ErrorState, Header, Ionicons, Loader, Sheet, useToast } from "@/src/ui";

const STEPS = ["confirmed", "preparing", "ready_for_pickup", "out_for_delivery", "delivered"];

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [otpSheet, setOtpSheet] = useState(false);
  const [cancelSheet, setCancelSheet] = useState(false);
  const [reorder, setReorder] = useState<{ available: Line[]; unavailable: Line[]; subtotal: number } | null>(null);
  const q = useQuery({ queryKey: ["order", id], queryFn: () => api<Order>(`/orders/${id}`), refetchInterval: 15000 });

  const run = async (key: string, fn: () => Promise<any>) => {
    setBusy(key);
    try {
      await fn();
      qc.invalidateQueries({ queryKey: ["order", id] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(null);
    }
  };

  if (q.isLoading) return <Loader />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  const o = q.data!;
  const stepIdx = STEPS.indexOf(o.status);

  const pay = () => router.push(`/pay/${o.id}`);
  const advance = () => {
    if (o.status === "out_for_delivery") return setOtpSheet(true);
    run("adv", () => api(`/delivery/orders/${o.id}/demo-advance`, { method: "POST", body: {} }));
  };
  const deliver = () => run("otp", async () => {
    await api(`/delivery/orders/${o.id}/demo-advance`, { method: "POST", body: { otp } });
    setOtpSheet(false); setOtp(""); toast("Delivered! Enjoy your order");
  });
  const openReorder = () => run("re", async () => setReorder(await api(`/orders/${o.id}/reorder`, { method: "POST", body: { confirm: false } })));
  const confirmReorder = () => run("rec", async () => {
    await api(`/orders/${o.id}/reorder`, { method: "POST", body: { confirm: true } });
    setReorder(null); qc.invalidateQueries({ queryKey: ["cart"] }); router.push("/(tabs)/cart");
  });

  return (
    <View style={s.root}>
      <Header title={o.order_no} subtitle={`${o.seller_name} · ${when(o.created_at)}`} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <View style={s.statusCard}>
          <Text testID="order-detail-status" style={s.status}>{STATUS_LABEL[o.status] ?? o.status}</Text>
          {o.scheduled_for ? <Text style={s.sub}>Scheduled for {when(o.scheduled_for)}</Text> : null}
          {o.payment_status === "failed" ? <Text testID="order-payment-failed" style={{ color: colors.error, fontWeight: "700" }}>Last payment attempt failed — order is not paid.</Text> : null}
          {o.payment_status === "refunded" ? <Text style={{ color: colors.success, fontWeight: "700" }}>Refund processed to original payment method</Text> : null}
          {o.status === "cancelled" && o.reject_note ? <Text testID="order-reject-note" style={s.sub}>Shop couldn&apos;t take this order: {o.reject_note}</Text> : null}
          {o.seller_managed && o.status === "confirmed" ? <Text style={s.sub}>Waiting for {o.seller_name} to accept your order…</Text> : null}
          {stepIdx >= 0 ? (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              {STEPS.map((st, i) => (
                <View key={st} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <View style={[s.dot, { backgroundColor: i <= stepIdx ? colors.success : colors.borderStrong }]}>
                    {i <= stepIdx ? <Ionicons name="checkmark" size={12} color={colors.onSuccess} /> : null}
                  </View>
                  <Text style={{ color: i <= stepIdx ? colors.onSurface : colors.muted, fontWeight: i === stepIdx ? "800" : "500" }}>{STATUS_LABEL[st]}</Text>
                  <Text style={{ marginLeft: "auto", color: colors.muted, fontSize: font.sm }}>{when(o.history.find((h) => h.status === st)?.at)}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {o.delivery_otp && ["paid", "cod"].includes(o.payment_status) && o.status !== "delivered" && o.status !== "cancelled" ? (
          <View style={s.otpCard} testID="order-delivery-otp-card">
            <Ionicons name="shield-checkmark" size={24} color={colors.onPastelMint} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.onPastelMint, fontWeight: "700" }}>Delivery OTP — share only with your rider</Text>
              {o.rider ? <Text style={{ color: colors.onPastelMint, fontSize: font.sm }}>{o.rider.name} · {o.rider.vehicle}</Text> : null}
            </View>
            <Text testID="order-delivery-otp" style={s.otp}>{o.delivery_otp}</Text>
          </View>
        ) : null}

        {["ready_for_pickup", "out_for_delivery"].includes(o.status) ? <LiveTrack orderId={o.id} /> : null}

        {o.payment_status === "cod" && o.status !== "cancelled" ? (
          <View style={s.codCard} testID="order-cod-card">
            <Ionicons name="cash-outline" size={22} color={colors.onPastelLemon} />
            <Text style={{ flex: 1, color: colors.onPastelLemon, fontWeight: "700" }}>Cash on delivery · keep {rupee(o.bill.total)} ready for your rider</Text>
          </View>
        ) : null}
        {o.payment_method === "cod" && o.payment_status === "paid" ? <Text testID="order-cod-paid" style={s.sub}>Paid in cash on delivery</Text> : null}

        {o.package_label ? (
          <View style={s.card} testID="order-package-label">
            <Text style={s.h}>Package label</Text>
            <Text style={s.mono}>{o.package_label.community} · Flat {o.package_label.flat}</Text>
            <Text style={s.mono}>Package {o.package_label.package_id} · Order {o.order_no}</Text>
            <Text style={s.sub}>{o.package_label.handling}</Text>
          </View>
        ) : null}

        <View style={s.card}>
          <Text style={s.h}>Items</Text>
          {o.items.map((i, idx) => (
            <View key={idx} style={{ flexDirection: "row", paddingVertical: 4 }}>
              <Text style={{ flex: 1, color: colors.onSurface }}>{i.qty} × {i.name}{i.user_name ? <Text style={{ color: colors.muted }}>  · {i.user_name}</Text> : null}</Text>
              <Text style={{ color: colors.onSurface, fontWeight: "600" }}>{rupee(i.line_total)}</Text>
            </View>
          ))}
          <View style={s.divider} />
          <BillRow label="Item total" value={rupee(o.bill.subtotal)} />
          {o.bill.discount ? <BillRow label="Discount" value={`-${rupee(o.bill.discount)}`} accent /> : null}
          <BillRow label="Delivery fee" value={o.bill.delivery_fee ? rupee(o.bill.delivery_fee) : "FREE"} accent={!o.bill.delivery_fee} />
          <BillRow label="Platform fee" value={rupee(o.bill.convenience_fee)} />
          <BillRow label="Total" value={rupee(o.bill.total)} bold testID="order-detail-total" />
          {o.kind === "community_flat" ? <Text style={s.sub}>Your flat's own bill. Shared rider trip saved you {rupee(Math.max(0, o.bill.delivery_cost))} vs a solo delivery estimate.</Text> : null}
        </View>

        {o.shares?.length ? (
          <View style={s.card} testID="order-group-shares">
            <Text style={s.h}>Split by member (items)</Text>
            {o.shares.map((sh) => <BillRow key={sh.user_id} label={sh.user_id === user?.id ? `${sh.name} (you)` : sh.name} value={rupee(sh.amount)} />)}
          </View>
        ) : null}

        {o.address ? (
          <View style={s.card}>
            <Text style={s.h}>Delivering to</Text>
            <Text style={{ color: colors.onSurfaceSecondary }}>{o.address.label} · {o.address.line}</Text>
          </View>
        ) : null}

        {o.status === "pending_payment" && o.is_payer ? <Button testID="order-pay-button" title={`Pay ${rupee(o.bill.total)}`} loading={busy === "pay"} onPress={pay} /> : null}
        {o.status === "pending_payment" && !o.is_payer ? <Text style={s.sub}>Waiting for the payer to complete payment.</Text> : null}
        {["paid", "cod"].includes(o.payment_status) && o.status !== "delivered" && o.status !== "cancelled" && (!o.seller_managed || ["ready_for_pickup", "out_for_delivery"].includes(o.status)) && !(o.rider as any)?.user_id ? (
          <View style={s.demo}>
            <Text style={s.demoText}>DEMO · The Rider app arrives in a later milestone. Simulate the next delivery step:</Text>
            <Button testID="order-demo-advance-button" variant="secondary" small title={o.status === "out_for_delivery" ? "Rider: verify OTP & deliver" : `Move to "${STATUS_LABEL[STEPS[stepIdx + 1]]}"`} loading={busy === "adv"} onPress={advance} />
          </View>
        ) : null}
        {o.is_payer && ["pending_payment", "confirmed"].includes(o.status) ? (
          <Button testID="order-cancel-button" variant="danger" title={o.payment_status === "paid" ? "Cancel & refund" : "Cancel order"} onPress={() => setCancelSheet(true)} />
        ) : null}
        {["delivered", "cancelled"].includes(o.status) ? <Button testID="order-reorder-button" icon="refresh" title="Reorder" loading={busy === "re"} onPress={openReorder} /> : null}
      </ScrollView>

      <Sheet visible={otpSheet} onClose={() => setOtpSheet(false)} title="Rider: enter delivery OTP" testID="otp-sheet">
        <Text style={s.sub}>The rider asks the customer for the 4-digit OTP before handing over.</Text>
        <TextInput testID="otp-sheet-input" value={otp} onChangeText={(t) => setOtp(t.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={4} placeholder="0000"
          placeholderTextColor={colors.borderStrong} style={s.otpInput} />
        <Button testID="otp-sheet-confirm" title="Confirm delivery" loading={busy === "otp"} disabled={otp.length !== 4} onPress={deliver} />
      </Sheet>

      <Sheet visible={cancelSheet} onClose={() => setCancelSheet(false)} title="Cancel this order?" testID="cancel-sheet">
        <Text style={s.sub}>{o.payment_status === "paid" ? `A refund of ${rupee(o.bill.total)} will be issued to your original payment method.` : "Your order will be cancelled."}</Text>
        <Button testID="cancel-sheet-confirm" variant="danger" title="Yes, cancel order" loading={busy === "cancel"}
          onPress={() => run("cancel", async () => { await api(`/orders/${o.id}/cancel`, { method: "POST" }); setCancelSheet(false); })} />
        <Button testID="cancel-sheet-keep" variant="ghost" title="Keep order" onPress={() => setCancelSheet(false)} />
      </Sheet>

      <Sheet visible={!!reorder} onClose={() => setReorder(null)} title="Reorder" testID="reorder-sheet">
        {reorder?.available.map((l) => (
          <View key={l.product_id} style={{ flexDirection: "row" }}>
            <Text style={{ flex: 1, color: colors.onSurface }}>{l.qty} × {l.name}</Text>
            <Text style={{ color: colors.onSurface }}>{rupee(l.line_total)}{(l as any).old_price && (l as any).old_price !== l.price ? `  (was ${rupee((l as any).old_price)})` : ""}</Text>
          </View>
        ))}
        {reorder?.unavailable.map((l) => <Text key={l.product_id} testID="reorder-unavailable" style={{ color: colors.error }}>{l.name} — unavailable</Text>)}
        <BillRow label="New item total" value={rupee(reorder?.subtotal)} bold />
        <Button testID="reorder-confirm-button" title="Add to cart" disabled={!reorder?.available.length} loading={busy === "rec"} onPress={confirmReorder} />
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  statusCard: { backgroundColor: c.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: c.border, gap: 4 },
  status: { fontSize: font.xl + 2, fontWeight: "800", color: c.onSurface },
  sub: { color: c.muted, fontSize: font.sm + 1, lineHeight: 18 },
  dot: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  otpCard: { backgroundColor: c.pastelMint, borderRadius: radius.md, padding: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md },
  otp: { fontSize: 28, fontWeight: "900", letterSpacing: 4, color: c.onPastelMint },
  card: { backgroundColor: c.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: c.border, gap: 4 },
  h: { fontWeight: "800", color: c.onSurface, fontSize: font.base + 1, marginBottom: 4 },
  mono: { color: c.onSurface, fontWeight: "700" },
  divider: { height: 1, backgroundColor: c.divider, marginVertical: spacing.sm },
  demo: { backgroundColor: c.pastelLemon, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  codCard: { backgroundColor: c.pastelLemon, borderRadius: radius.md, padding: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md },
  demoText: { color: c.onPastelLemon, fontSize: font.sm, fontWeight: "600" },
  otpInput: { height: 60, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary, textAlign: "center", fontSize: 28, letterSpacing: 12, color: c.onSurface, fontWeight: "800" },
}));
