import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AddressPicker, useAddresses } from "@/src/components/address-picker";
import { rupee } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Address, Bill, Line, Seller } from "@/src/types";
import { BillRow, Button, Chip, ChipRow, EmptyState, ErrorState, Ionicons, Loader, Stepper, useToast, VegMark } from "@/src/ui";

type CartView = { seller: Seller | null; items: Line[]; unavailable: Line[]; bill: Bill | null };
const SCHEDULES = [
  { key: "now", label: "Now" }, { key: "1h", label: "In 1 hour" }, { key: "2h", label: "In 2 hours" },
  { key: "tonight", label: "Tonight 8 PM" }, { key: "tomorrow", label: "Tomorrow 9 AM" },
] as const;

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const { user, refresh } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState<string | null>(null);
  const [useCredit, setUseCredit] = useState(false);
  const [schedule, setSchedule] = useState<(typeof SCHEDULES)[number]["key"]>("now");
  const [addr, setAddr] = useState<Address | null>(null);
  const [picker, setPicker] = useState(false);
  const [placing, setPlacing] = useState(false);
  const addresses = useAddresses();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const q = useQuery({
    queryKey: ["cart", applied, useCredit],
    queryFn: () => api<CartView>("/cart/quote", { method: "POST", body: { coupon: applied, use_credit: useCredit } }),
  });

  useEffect(() => {
    if (!addr && addresses.data?.length) setAddr(addresses.data.find((a) => a.is_default) ?? addresses.data[0]);
  }, [addresses.data, addr]);

  const setQty = async (product_id: string, qty: number) => {
    try {
      await api("/cart/items", { method: "POST", body: { product_id, qty } });
      qc.invalidateQueries({ queryKey: ["cart"] });
    } catch (e: any) {
      toast(e.message, "err");
    }
  };

  const applyCoupon = async () => {
    const code = coupon.trim().toUpperCase();
    if (!code) return;
    try {
      const r = await api<CartView>("/cart/quote", { method: "POST", body: { coupon: code, use_credit: useCredit } });
      if (r.bill?.error) throw new Error(r.bill.error);
      setApplied(code);
      toast(`${code} applied`);
    } catch (e: any) {
      toast(e.message, "err");
    }
  };

  const place = async () => {
    if (!addr) return setPicker(true);
    setPlacing(true);
    try {
      const order = await api<{ id: string }>("/orders/checkout", { method: "POST", body: { address_id: addr.id, coupon: applied, use_credit: useCredit, schedule } });
      const pay = await api<{ id: string }>("/payments/initiate", { method: "POST", body: { order_id: order.id } });
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      setApplied(null); setCoupon(""); setUseCredit(false);
      router.push(`/pay/${pay.id}?orderId=${order.id}`);
      refresh();
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setPlacing(false);
    }
  };

  const data = q.data;
  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={s.h1}>Your cart</Text>
        {data?.seller ? <Text style={s.hsub}>{data.seller.name} · {data.seller.eta_min} mins</Text> : null}
      </View>
      {q.isLoading ? <Loader /> : q.isError ? <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} /> : !data?.items.length && !data?.unavailable.length ? (
        <EmptyState testID="cart-empty" icon="bag-handle-outline" title="Your cart is feeling lonely" body="Add something delicious or stock up on groceries from shops nearby."
          action="Browse food" onAction={() => router.push("/listing/food")} />
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl }} keyboardShouldPersistTaps="handled">
            <View style={s.card}>
              {data!.items.map((l) => (
                <View key={l.product_id} style={s.line} testID={`cart-line-${l.product_id}`}>
                  <VegMark veg={l.veg} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.lineName}>{l.name}</Text>
                    <Text style={s.linePrice}>{rupee(l.price)}</Text>
                  </View>
                  <Stepper testID={`cart-stepper-${l.product_id}`} qty={l.qty} onChange={(n) => setQty(l.product_id, n)} />
                  <Text style={s.lineTotal}>{rupee(l.line_total)}</Text>
                </View>
              ))}
              {data!.unavailable.map((l) => (
                <View key={l.product_id} style={[s.line, { opacity: 0.5 }]}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                  <Text style={[s.lineName, { flex: 1 }]}>{l.name} · {(l as any).reason}</Text>
                  <Pressable testID={`cart-remove-unavailable-${l.product_id}`} onPress={() => setQty(l.product_id, 0)}><Text style={{ color: colors.error, fontWeight: "700" }}>Remove</Text></Pressable>
                </View>
              ))}
            </View>

            <Text style={s.label}>Delivery time</Text>
            <View style={{ marginHorizontal: -spacing.lg }}>
              <ChipRow>
                {SCHEDULES.map((x) => <Chip key={x.key} testID={`cart-schedule-${x.key}`} label={x.label} icon={x.key === "now" ? "flash-outline" : "time-outline"} selected={schedule === x.key} onPress={() => setSchedule(x.key)} />)}
              </ChipRow>
            </View>

            <View style={s.card}>
              <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
                <Ionicons name="pricetag-outline" size={20} color={colors.brandPrimary} />
                {applied ? (
                  <>
                    <Text testID="cart-coupon-applied" style={[s.lineName, { flex: 1 }]}>{applied} applied</Text>
                    <Pressable testID="cart-coupon-remove" onPress={() => setApplied(null)}><Text style={{ color: colors.error, fontWeight: "700" }}>Remove</Text></Pressable>
                  </>
                ) : (
                  <>
                    <TextInput testID="cart-coupon-input" value={coupon} onChangeText={setCoupon} placeholder="Coupon code (GATHR50)" autoCapitalize="characters"
                      placeholderTextColor={colors.muted} style={s.couponInput} />
                    <Pressable testID="cart-coupon-apply" onPress={applyCoupon} style={s.applyBtn}><Text style={{ color: colors.brandPrimary, fontWeight: "800" }}>APPLY</Text></Pressable>
                  </>
                )}
              </View>
              {(user?.delivery_credits ?? 0) > 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.md }}>
                  <Text style={{ flex: 1, color: colors.onSurface, fontWeight: "600" }}>Use a free-delivery credit ({user?.delivery_credits} left)</Text>
                  <Switch testID="cart-use-credit-switch" value={useCredit} onValueChange={setUseCredit} trackColor={{ true: colors.brandSecondary, false: colors.borderStrong }} thumbColor={colors.surface} />
                </View>
              ) : null}
            </View>

            {data!.bill ? (
              <View style={s.card} testID="cart-bill">
                <Text style={[s.label, { marginBottom: spacing.sm }]}>Bill details</Text>
                {data!.bill.error ? <Text testID="cart-bill-error" style={{ color: colors.error, fontWeight: "600" }}>{data!.bill.error}</Text> : (
                  <>
                    <BillRow label="Item total" value={rupee(data!.bill.subtotal)} />
                    {data!.bill.discount ? <BillRow label={`Coupon ${data!.bill.coupon}`} value={`-${rupee(data!.bill.discount)}`} accent /> : null}
                    <BillRow label="Delivery fee" value={data!.bill.delivery_fee === 0 ? `FREE (${data!.bill.delivery_funding === "delivery_credit" ? "credit" : "platform"})` : rupee(data!.bill.delivery_fee)} accent={data!.bill.delivery_fee === 0} />
                    <BillRow label="Platform fee" value={rupee(data!.bill.convenience_fee)} />
                    <View style={s.divider} />
                    <BillRow label="To pay" value={rupee(data!.bill.total)} bold testID="cart-bill-total" />
                  </>
                )}
              </View>
            ) : null}
          </ScrollView>

          <View style={[s.footer, { paddingBottom: bottomChrome + spacing.md }]}>
            <Pressable testID="cart-address-selector" onPress={() => setPicker(true)} style={s.addr}>
              <Ionicons name="location-outline" size={18} color={colors.brandPrimary} />
              <Text style={{ flex: 1, color: colors.onSurface, fontWeight: "600" }} numberOfLines={1}>{addr ? `${addr.label} · ${addr.line}` : "Select delivery address"}</Text>
              <Text style={{ color: colors.brandPrimary, fontWeight: "800" }}>Change</Text>
            </Pressable>
            <Button testID="cart-place-order-button" title={data!.bill?.total ? `Place order · ${rupee(data!.bill.total)}` : "Place order"} loading={placing}
              disabled={!data!.bill || !!data!.bill.error || !data!.items.length} onPress={place} />
          </View>
        </>
      )}
      <AddressPicker visible={picker} onClose={() => setPicker(false)} selected={addr?.id} onSelect={setAddr} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.divider },
  h1: { fontSize: font.xxl, fontWeight: "800", color: c.onSurface },
  hsub: { color: c.muted, marginTop: 2 },
  card: { backgroundColor: c.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: c.border },
  line: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  lineName: { fontWeight: "700", color: c.onSurface, fontSize: font.base },
  linePrice: { color: c.muted, fontSize: font.sm },
  lineTotal: { width: 60, textAlign: "right", fontWeight: "700", color: c.onSurface },
  label: { fontWeight: "800", color: c.onSurface, fontSize: font.base + 1 },
  couponInput: { flex: 1, height: 44, color: c.onSurface, fontSize: font.base },
  applyBtn: { height: 44, justifyContent: "center", paddingHorizontal: spacing.sm },
  divider: { height: 1, backgroundColor: c.divider, marginVertical: spacing.sm },
  footer: { backgroundColor: c.surface, paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md, borderTopWidth: 1, borderTopColor: c.border },
  addr: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 44 },
}));
