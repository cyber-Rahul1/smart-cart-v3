import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { rupee, STATUS_LABEL, when } from "@/src/format";
import { KIND_LABEL, SellerOrder } from "@/src/partner";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { BillRow, Button, Chip, ErrorState, Header, Ionicons, Loader, Sheet, useToast } from "@/src/ui";

const REASONS = ["Item unavailable", "Kitchen too busy", "Closing soon"];

export default function PartnerOrder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [reject, setReject] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const q = useQuery({ queryKey: ["seller-order", id], queryFn: () => api<SellerOrder>(`/seller/orders/${id}`) });

  const run = async (key: string, fn: () => Promise<any>, msg?: string) => {
    setBusy(key);
    try {
      const o = await fn();
      qc.setQueryData(["seller-order", id], o);
      qc.invalidateQueries({ queryKey: ["seller-orders"] });
      qc.invalidateQueries({ queryKey: ["seller-summary"] });
      qc.invalidateQueries({ queryKey: ["seller-batches"] });
      if (msg) toast(msg);
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(null);
    }
  };

  if (q.isLoading) return <Loader />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  const o = q.data!;
  const packedCount = o.packed.filter(Boolean).length;

  return (
    <View style={s.root}>
      <Header title={o.order_no} subtitle={`${KIND_LABEL(o)} · ${when(o.created_at)}`} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + 140 }}>
        <View style={s.card}>
          <Text testID="partner-order-detail-status" style={s.status}>{STATUS_LABEL[o.status]}</Text>
          {o.scheduled_for ? <Text style={s.sched}>Scheduled delivery: {when(o.scheduled_for)}</Text> : null}
          <Text style={s.sub}>Deliver to: {o.area}</Text>
          {o.notes ? <Text style={s.sub}>Note: {o.notes}</Text> : null}
        </View>

        {o.package_label ? (
          <View style={[s.card, { borderStyle: "dashed", borderColor: colors.onSurface, borderWidth: 1.5 }]} testID="partner-package-label">
            <Text style={s.labelTitle}>PACKAGE LABEL</Text>
            <Text style={s.labelBig}>Flat {o.package_label.flat}</Text>
            <Text style={s.labelLine}>{o.package_label.community}</Text>
            <Text style={s.labelLine}>Order {o.order_no} · {o.package_label.package_id}</Text>
            {o.package_label.items.map((it) => <Text key={it} style={s.sub}>• {it}</Text>)}
            <Text style={[s.sub, { fontStyle: "italic" }]}>{o.package_label.handling}</Text>
          </View>
        ) : null}

        <View style={s.card} testID="partner-packing-checklist">
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={[s.h, { flex: 1 }]}>Packing checklist</Text>
            <Text testID="partner-packed-count" style={s.sub}>{packedCount}/{o.items.length} packed</Text>
          </View>
          {o.status !== "preparing" && o.status === "confirmed" ? <Text style={s.sub}>Accept the order to start packing.</Text> : null}
          {o.items.map((i, idx) => {
            const on = o.packed[idx];
            return (
              <Pressable key={idx} testID={`partner-pack-item-${idx}`} disabled={o.status !== "preparing" || busy === `p${idx}`}
                onPress={() => run(`p${idx}`, () => api(`/seller/orders/${o.id}/pack`, { method: "POST", body: { index: idx, checked: !on } }))}
                style={[s.check, on && { backgroundColor: colors.pastelMint }]}>
                <Ionicons name={on ? "checkbox" : "square-outline"} size={24} color={on ? colors.success : colors.muted} />
                <Text style={{ flex: 1, color: colors.onSurface, fontWeight: "700", textDecorationLine: on ? "line-through" : "none" }}>{i.qty} × {i.name}</Text>
                {i.user_name ? <Text style={s.sub}>{i.user_name}</Text> : null}
              </Pressable>
            );
          })}
        </View>

        <View style={s.card}>
          <BillRow label="Item total" value={rupee(o.subtotal)} />
          <BillRow label="Platform commission" value={`-${rupee(o.commission)}`} />
          <BillRow label="Your payout" value={rupee(o.payout)} bold testID="partner-order-payout" />
          <Text style={s.sub}>Customer contact, delivery OTP and payment details are not shared with shops.</Text>
        </View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {o.status === "confirmed" ? (
          <>
            <Button testID="partner-reject-button" variant="danger" title="Reject" style={{ flex: 1 }} onPress={() => setReject(true)} />
            <Button testID="partner-accept-button" title="Accept order" style={{ flex: 2 }} loading={busy === "acc"}
              onPress={() => run("acc", () => api(`/seller/orders/${o.id}/accept`, { method: "POST" }), "Order accepted")} />
          </>
        ) : o.status === "preparing" ? (
          <Button testID="partner-ready-button" title={o.all_packed ? "Mark packed · ready for pickup" : `Pack all items (${packedCount}/${o.items.length})`} style={{ flex: 1 }}
            disabled={!o.all_packed} loading={busy === "ready"} onPress={() => run("ready", () => api(`/seller/orders/${o.id}/ready`, { method: "POST" }), "Ready for pickup")} />
        ) : (
          <Text style={[s.sub, { flex: 1, textAlign: "center" }]}>{o.status === "ready_for_pickup" ? "Waiting for rider pickup" : STATUS_LABEL[o.status]}</Text>
        )}
      </View>

      <Sheet visible={reject} onClose={() => setReject(false)} title="Reject this order?" testID="partner-reject-sheet">
        <Text style={s.sub}>The customer gets a full refund automatically.</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {REASONS.map((r) => <Chip key={r} testID={`partner-reject-reason-${r.split(" ")[0]}`} label={r} selected={reason === r} onPress={() => setReason(r)} />)}
        </View>
        <Button testID="partner-reject-confirm" variant="danger" title="Reject & refund" loading={busy === "rej"}
          onPress={() => run("rej", async () => { const r = await api(`/seller/orders/${o.id}/reject`, { method: "POST", body: { reason } }); setReject(false); return r; }, "Order rejected · customer refunded")} />
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  card: { backgroundColor: c.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: c.border, gap: 6 },
  status: { fontSize: font.xl + 2, fontWeight: "800", color: c.onSurface },
  sched: { color: c.onPastelLilac, backgroundColor: c.pastelLilac, alignSelf: "flex-start", paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm, fontWeight: "700", overflow: "hidden" },
  sub: { color: c.muted, fontSize: font.sm + 1 },
  h: { fontWeight: "800", color: c.onSurface, fontSize: font.base + 1 },
  check: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 48, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  labelTitle: { fontWeight: "900", color: c.muted, letterSpacing: 2, fontSize: font.sm },
  labelBig: { fontWeight: "900", color: c.onSurface, fontSize: 28 },
  labelLine: { fontWeight: "700", color: c.onSurface },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: spacing.sm, backgroundColor: c.surface, padding: spacing.lg, borderTopWidth: 1, borderTopColor: c.border },
}));
