import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { rupee, STATUS_LABEL, timeLeft, when } from "@/src/format";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, ErrorState, Header, Ionicons, Loader, Sheet, Stepper, useToast } from "@/src/ui";

type B = { id: string; title: string; community_name: string; seller_id: string; seller_name: string; status: string; closes_at: string; deliver_at: string | null;
  my_flat: string; my_items: { id: string; product_id: string; name: string; price: number; qty: number }[]; my_subtotal: number;
  flats: { flat: string; item_count: number; is_mine: boolean }[]; can_close: boolean;
  my_order: { id: string; order_no: string; status: string; payment_status: string; bill: { total: number } } | null };
type Plan = { riders_needed: number; split: boolean; total_packages: number; total_weight: number;
  manifests: { rider: { name: string; vehicle: string; max_packages: number }; packages: { flat: string; package_id: string; weight: number }[]; load: number }[];
  unassigned: { flat: string }[] };

export default function Basket() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const [, tick] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const q = useQuery({ queryKey: ["basket", id], queryFn: () => api<B>(`/community-baskets/${id}`), refetchInterval: 10000 });
  const closed = q.data?.status === "closed";
  const plan = useQuery({ queryKey: ["plan", id], queryFn: () => api<Plan>(`/community-baskets/${id}/delivery-plan`), enabled: closed });

  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const act = async (key: string, fn: () => Promise<any>) => {
    setBusy(key);
    try {
      await fn();
      qc.invalidateQueries({ queryKey: ["basket", id] });
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(null);
    }
  };

  if (q.isLoading) return <Loader />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  const b = q.data!;
  const open = b.status === "open" && new Date(b.closes_at).getTime() > Date.now();

  return (
    <View style={s.root}>
      <Header title={b.title} subtitle={`${b.community_name} · ${b.seller_name}`} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + 160 }}>
        <View style={[s.timer, { backgroundColor: open ? colors.pastelSky : colors.surfaceTertiary }]}>
          <Ionicons name={open ? "timer-outline" : "lock-closed-outline"} size={24} color={colors.onPastelSky} />
          <View style={{ flex: 1 }}>
            <Text testID="basket-status" style={s.timerTitle}>{open ? timeLeft(b.closes_at) : b.status === "closed" ? "Basket closed · flat orders created" : b.status}</Text>
            <Text style={s.sub}>Closes {when(b.closes_at)}{b.deliver_at ? ` · Delivery ${when(b.deliver_at)}` : ""}</Text>
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.h}>Flats participating</Text>
          <Text style={s.sub}>Each flat gets its own order, bill, payment and package. You only see other flats' item counts.</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm }}>
            {b.flats.length ? b.flats.map((f) => (
              <View key={f.flat} testID={`basket-flat-${f.flat}`} style={[s.flat, f.is_mine && { backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary }]}>
                <Text style={{ fontWeight: "800", color: colors.onSurface }}>Flat {f.flat}</Text>
                <Text style={{ color: colors.muted, fontSize: font.sm }}>{f.item_count} item{f.item_count === 1 ? "" : "s"}</Text>
              </View>
            )) : <Text style={{ color: colors.muted }}>No flats yet — be the first.</Text>}
          </View>
        </View>

        <View style={s.card} testID="basket-my-items">
          <Text style={s.h}>Flat {b.my_flat} — your items</Text>
          {!b.my_items.length ? <Text style={s.sub}>Nothing added yet.</Text> : null}
          {b.my_items.map((i) => (
            <View key={i.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", color: colors.onSurface }}>{i.name}</Text>
                <Text style={{ color: colors.muted, fontSize: font.sm }}>{rupee(i.price)}</Text>
              </View>
              {open ? <Stepper testID={`basket-stepper-${i.id}`} qty={i.qty} disabled={busy === i.id}
                onChange={(n) => act(i.id, () => api(`/community-baskets/${id}/items/${i.id}`, { method: "PATCH", body: { qty: n } }))} /> : <Text style={{ color: colors.onSurface }}>× {i.qty}</Text>}
            </View>
          ))}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm }}>
            <Text style={{ fontWeight: "800", color: colors.onSurface }}>Flat item total</Text>
            <Text testID="basket-my-subtotal" style={{ fontWeight: "800", color: colors.onSurface }}>{rupee(b.my_subtotal)}</Text>
          </View>
        </View>

        {b.my_order ? (
          <View style={[s.card, { borderColor: colors.brandPrimary }]} testID="basket-my-order">
            <Text style={s.h}>Your flat order {b.my_order.order_no}</Text>
            <Text style={s.sub}>{STATUS_LABEL[b.my_order.status]} · {rupee(b.my_order.bill.total)} incl. shared delivery</Text>
            <Button testID="basket-open-my-order" small title={b.my_order.payment_status === "paid" ? "Track order" : "View bill & pay"} onPress={() => router.push(`/orders/${b.my_order!.id}`)} style={{ marginTop: spacing.sm }} />
          </View>
        ) : null}

        {closed && plan.data ? (
          <View style={s.card} testID="basket-delivery-plan">
            <Text style={s.h}>Delivery plan {plan.data.split ? "· Split delivery" : "· One rider"}</Text>
            <Text style={s.sub}>{plan.data.total_packages} packages · {plan.data.total_weight} kg · {plan.data.riders_needed} rider(s). A flat's package is never split.</Text>
            {plan.data.manifests.map((m, i) => (
              <View key={i} style={{ marginTop: spacing.sm }}>
                <Text style={{ fontWeight: "700", color: colors.onSurface }}>{m.rider.name} ({m.rider.vehicle}) · {m.load} kg</Text>
                <Text style={{ color: colors.muted }}>{m.packages.map((p) => `Flat ${p.flat}`).join(", ")}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {open ? <Button testID="basket-add-items" icon="add" variant="secondary" title="Add items" style={{ flex: 1 }} onPress={() => router.push(`/seller/${b.seller_id}?bk=${b.id}`)} /> : null}
        {open && b.can_close ? <Button testID="basket-close-button" title="Close basket" style={{ flex: 1 }} loading={busy === "close"}
          onPress={() => setConfirm(true)} /> : null}
        {!open ? <Text style={[s.sub, { flex: 1, textAlign: "center" }]}>This basket is closed.</Text> : null}
      </View>
      <Sheet visible={confirm} onClose={() => setConfirm(false)} title="Close basket now?" testID="basket-close-confirm-sheet">
        <Text style={s.sub}>No one can add items after this. A separate order and bill is created for every participating flat.</Text>
        <Button testID="basket-close-confirm" title="Close & create flat orders" loading={busy === "close"}
          onPress={() => act("close", async () => { const r = await api<{ orders_created: number }>(`/community-baskets/${id}/close`, { method: "POST" }); setConfirm(false); toast(`${r.orders_created} separate flat orders created`); qc.invalidateQueries({ queryKey: ["orders"] }); })} />
        <Button testID="basket-close-cancel" variant="ghost" title="Keep it open" onPress={() => setConfirm(false)} />
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  timer: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.md },
  timerTitle: { fontWeight: "900", fontSize: font.lg + 2, color: c.onSurface },
  sub: { color: c.muted, fontSize: font.sm + 1, lineHeight: 18 },
  card: { backgroundColor: c.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: c.border },
  h: { fontWeight: "800", color: c.onSurface, fontSize: font.base + 1, marginBottom: 4 },
  flat: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: spacing.sm, backgroundColor: c.surface, padding: spacing.lg, borderTopWidth: 1, borderTopColor: c.border },
}));
