import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AddressPicker } from "@/src/components/address-picker";
import { PERM_LABELS } from "@/src/components/pickers";
import { rupee, timeLeft, when } from "@/src/format";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Address } from "@/src/types";
import { Button, EmptyState, ErrorState, Header, Ionicons, Loader, Sheet, Stepper, useToast, VegMark } from "@/src/ui";

type Item = { id: string; user_id: string; user_name: string; product_id: string; name: string; price: number; qty: number; veg?: boolean };
type GC = { id: string; group_id: string; group_name: string; name: string; owner_id: string; seller_id: string; seller_name: string; status: string;
  closes_at: string; deliver_at: string | null; items: Item[]; subtotal: number; shares: { user_id: string; name: string; amount: number; count: number }[];
  my_share: number; is_owner: boolean; my_permissions: Record<string, boolean>; permissions: Record<string, boolean>; order_id: string | null };

export default function GroupCart() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [, tick] = useState(0);
  const [picker, setPicker] = useState(false);
  const [permSheet, setPermSheet] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["group-cart", id], queryFn: () => api<GC>(`/group-carts/${id}`), refetchInterval: 8000 });

  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const act = async (key: string, fn: () => Promise<any>) => {
    setBusy(key);
    try {
      await fn();
      qc.invalidateQueries({ queryKey: ["group-cart", id] });
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(null);
    }
  };

  if (q.isLoading) return <Loader />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  const c = q.data!;
  const open = c.status === "open" && new Date(c.closes_at).getTime() > Date.now();
  const p = c.my_permissions;

  const finalize = (a: Address) => act("fin", async () => {
    const o = await api<{ id: string }>(`/group-carts/${id}/finalize`, { method: "POST", body: { address_id: a.id } });
    qc.invalidateQueries({ queryKey: ["orders"] });
    router.push(`/pay/${o.id}`);
  });

  return (
    <View style={s.root}>
      <Header title={c.name} subtitle={`${c.group_name} · ${c.seller_name}`}
        right={c.is_owner ? <Pressable testID="group-cart-permissions-button" onPress={() => setPermSheet(true)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="shield-half-outline" size={22} color={colors.onSurface} /></Pressable> : undefined} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + 180 }}>
        <View style={[s.timer, { backgroundColor: open ? colors.brandTertiary : colors.surfaceTertiary }]}>
          <Ionicons name={open ? "timer-outline" : "lock-closed-outline"} size={24} color={open ? colors.brandPrimary : colors.muted} />
          <View style={{ flex: 1 }}>
            <Text testID="group-cart-status" style={s.timerTitle}>{open ? timeLeft(c.closes_at) : c.status === "finalized" ? "Order placed" : "Cart closed"}</Text>
            <Text style={s.timerSub}>Closes {when(c.closes_at)}{c.deliver_at ? ` · Delivery ${when(c.deliver_at)}` : ""}</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {c.shares.map((sh) => (
            <View key={sh.user_id} style={s.share}>
              <View style={s.av}><Text style={s.avText}>{sh.name.slice(0, 1).toUpperCase()}</Text></View>
              <Text style={{ fontWeight: "700", color: colors.onSurface, fontSize: font.sm + 1 }}>{sh.user_id === user?.id ? "You" : sh.name.split(" ")[0]} · {rupee(sh.amount)}</Text>
            </View>
          ))}
        </View>

        {!c.items.length ? <EmptyState testID="group-cart-empty" icon="fast-food-outline" title="Cart is empty" body="Add your item first — your roommates can add theirs from anywhere." /> : (
          <View style={s.card}>
            {c.items.map((i) => {
              const own = i.user_id === user?.id;
              const canMod = open && (own ? p.modify_own : p.modify_others);
              const canRemove = open && (own ? p.remove_own : p.remove_others);
              return (
                <View key={i.id} style={s.line} testID={`group-cart-item-${i.id}`}>
                  <VegMark veg={i.veg} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "700", color: colors.onSurface }}>{i.name}</Text>
                    <Text style={{ color: colors.muted, fontSize: font.sm }}>by {own ? "you" : i.user_name} · {rupee(i.price)}</Text>
                  </View>
                  {canMod || canRemove ? (
                    <Stepper testID={`group-cart-stepper-${i.id}`} qty={i.qty} disabled={busy === i.id}
                      onChange={(n) => (n === 0 && !canRemove) || (n > 0 && !canMod) ? toast("You don't have permission for that", "err") :
                        act(i.id, () => api(`/group-carts/${id}/items/${i.id}`, { method: "PATCH", body: { qty: n } }))} />
                  ) : <Text style={{ fontWeight: "700", color: colors.onSurface }}>× {i.qty}</Text>}
                </View>
              );
            })}
            <View style={s.divider} />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontWeight: "800", color: colors.onSurface }}>Group item total</Text>
              <Text testID="group-cart-subtotal" style={{ fontWeight: "800", color: colors.onSurface }}>{rupee(c.subtotal)}</Text>
            </View>
          </View>
        )}
        {c.order_id ? <Button testID="group-cart-view-order" variant="secondary" title="View order" onPress={() => router.push(`/orders/${c.order_id}`)} /> : null}
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View>
            <Text style={{ color: colors.muted, fontSize: font.sm }}>Your share</Text>
            <Text testID="group-cart-my-share" style={{ fontWeight: "900", fontSize: font.xl, color: colors.onSurface }}>{rupee(c.my_share)}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: colors.muted, fontSize: font.sm }}>Group total</Text>
            <Text style={{ fontWeight: "900", fontSize: font.xl, color: colors.brandPrimary }}>{rupee(c.subtotal)}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {open && p.add_items ? <Button testID="group-cart-add-items" icon="add" variant="secondary" title="Add" style={{ flex: 1 }} onPress={() => router.push(`/seller/${c.seller_id}?gc=${c.id}`)} /> : null}
          {open && p.close_cart ? <Button testID="group-cart-close-button" variant="secondary" title="Close" style={{ flex: 1 }} loading={busy === "close"}
            onPress={() => act("close", () => api(`/group-carts/${id}/close`, { method: "POST" }))} /> : null}
          {c.status !== "finalized" && p.finalize && c.items.length ? <Button testID="group-cart-finalize-button" title="Finalize" style={{ flex: 1 }} loading={busy === "fin"} onPress={() => setPicker(true)} /> : null}
        </View>
      </View>

      <AddressPicker visible={picker} onClose={() => setPicker(false)} onSelect={finalize} />
      <Sheet visible={permSheet} onClose={() => setPermSheet(false)} title="Member permissions" testID="group-perm-sheet">
        <Text style={{ color: colors.muted }}>Enforced by the server — members can't bypass these.</Text>
        {PERM_LABELS.map(([k, l]) => (
          <View key={k} style={{ flexDirection: "row", alignItems: "center", minHeight: 40 }}>
            <Text style={{ flex: 1, color: colors.onSurface }}>{l}</Text>
            <Switch testID={`perm-edit-${k}`} value={!!c.permissions[k]} trackColor={{ true: colors.brandSecondary, false: colors.borderStrong }} thumbColor={colors.surface}
              onValueChange={(v) => act("perm", () => api(`/group-carts/${id}/permissions`, { method: "PUT", body: { ...c.permissions, [k]: v } }))} />
          </View>
        ))}
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  timer: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.md },
  timerTitle: { fontWeight: "900", fontSize: font.xl, color: c.onSurface },
  timerSub: { color: c.onSurfaceSecondary, fontSize: font.sm },
  share: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.surface, borderRadius: radius.pill, paddingRight: spacing.md, padding: 4, borderWidth: 1, borderColor: c.border },
  av: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.pastelLilac, alignItems: "center", justifyContent: "center" },
  avText: { color: c.onPastelLilac, fontWeight: "900", fontSize: font.sm },
  card: { backgroundColor: c.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: c.border },
  line: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  divider: { height: 1, backgroundColor: c.divider, marginVertical: spacing.sm },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: c.surface, padding: spacing.lg, gap: spacing.md, borderTopWidth: 1, borderTopColor: c.border },
}));
