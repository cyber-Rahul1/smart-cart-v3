import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { MapMarker, OsmMap } from "@/src/components/osm-map";
import { rupee, STATUS_LABEL } from "@/src/format";
import { LocationExplainSheet, useLocationAccess } from "@/src/location";
import { RiderJob } from "@/src/rider";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, ErrorState, Header, Ionicons, Loader, Sheet, useToast } from "@/src/ui";

export default function RiderOrder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const [otp, setOtp] = useState("");
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ["rider-order", id], queryFn: () => api<RiderJob>(`/rider/orders/${id}`) });
  const loc = useLocationAccess();
  const perm = useQuery({ queryKey: ["loc-perm"], queryFn: () => Location.getForegroundPermissionsAsync() });
  const [cash, setCash] = useState(false);
  const allowLocation = async () => { if (await loc.request()) qc.invalidateQueries({ queryKey: ["loc-perm"] }); };
  const startSharing = async () => { if (await loc.ensure()) qc.invalidateQueries({ queryKey: ["loc-perm"] }); };
  const navigate = (p: { lat: number; lng: number } | null) => p && Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=two-wheeler`);

  const run = async (fn: () => Promise<RiderJob>, msg: string) => {
    setBusy(true);
    try {
      qc.setQueryData(["rider-order", id], await fn());
      qc.invalidateQueries({ queryKey: ["rider-active"] });
      qc.invalidateQueries({ queryKey: ["rider-history"] });
      toast(msg);
      return true;
    } catch (e: any) {
      toast(e.message, "err");
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (q.isLoading) return <Loader />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  const j = q.data!;
  const live = ["ready_for_pickup", "out_for_delivery"].includes(j.status);
  const markers: MapMarker[] = [];
  if (j.pickup_point) markers.push({ id: "shop", kind: "shop", ...j.pickup_point });
  if (j.drop_point) markers.push({ id: "home", kind: "home", ...j.drop_point });
  const next = j.status === "ready_for_pickup" ? j.pickup_point : j.drop_point;
  return (
    <View style={s.root}>
      <Header title={j.order_no} subtitle={STATUS_LABEL[j.status]} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + 120 }}>
        {markers.length ? (
          <View style={[s.card, { padding: 0, overflow: "hidden" }]}>
            <View style={{ height: 200 }}>
              <OsmMap testID="rider-order-map" center={markers[0]} zoom={14} markers={markers} fitMarkers route />
            </View>
            {live && next ? (
              <Pressable testID="rider-navigate-button" onPress={() => navigate(next)} style={s.navBtn}>
                <Ionicons name="navigate" size={18} color={colors.brandPrimary} />
                <Text style={{ color: colors.brandPrimary, fontWeight: "800" }}>Navigate to {j.status === "ready_for_pickup" ? "shop" : "customer"}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {live ? (
          perm.data?.granted ? (
            <View testID="rider-sharing-on" style={[s.banner, { backgroundColor: colors.pastelMint }]}>
              <Ionicons name="radio-outline" size={18} color={colors.onPastelMint} />
              <Text style={{ flex: 1, color: colors.onPastelMint, fontWeight: "700" }}>Sharing live location with the customer while you deliver</Text>
            </View>
          ) : (
            <Pressable testID="rider-share-location" onPress={startSharing} style={[s.banner, { backgroundColor: colors.pastelLemon }]}>
              <Ionicons name="location-outline" size={18} color={colors.onPastelLemon} />
              <Text style={{ flex: 1, color: colors.onPastelLemon, fontWeight: "700" }}>Turn on live location so the customer can track you</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.onPastelLemon} />
            </Pressable>
          )
        ) : null}
        {j.collect_cash ? (
          <View testID="rider-collect-cash" style={[s.banner, { backgroundColor: colors.pastelRose }]}>
            <Ionicons name="cash-outline" size={20} color={colors.onPastelRose} />
            <Text style={{ flex: 1, color: colors.onPastelRose, fontWeight: "800" }}>Cash on delivery · collect {rupee(j.collect_cash)}</Text>
          </View>
        ) : null}
        <View style={s.card}>
          <View style={s.row}><Ionicons name="storefront" size={20} color={colors.brandPrimary} /><Text style={s.h}>Pickup</Text></View>
          <Text style={s.body}>{j.pickup.name}</Text><Text style={s.sub}>{j.pickup.address}</Text>
        </View>
        <View style={s.card}>
          <View style={s.row}><Ionicons name="location" size={20} color={colors.success} /><Text style={s.h}>Drop · {j.drop.name}</Text></View>
          <Text style={s.body}>{j.flat ? `Flat ${j.flat}, ${j.community_name}` : j.drop.address}</Text>
          {j.drop.landmark ? <Text style={s.sub}>{j.drop.landmark}</Text> : null}
        </View>
        {j.package_label ? (
          <View style={[s.card, { borderStyle: "dashed", borderWidth: 1.5, borderColor: colors.onSurface }]} testID="rider-package-label">
            <Text style={s.sub}>PACKAGE</Text>
            <Text style={{ fontSize: 26, fontWeight: "900", color: colors.onSurface }}>Flat {j.package_label.flat}</Text>
            <Text style={s.body}>{j.package_label.package_id} · {j.package_label.community}</Text>
            <Text style={s.sub}>{j.package_label.handling}</Text>
          </View>
        ) : null}
        <View style={s.card}>
          <Text style={s.h}>Items ({j.item_count} · {j.weight} kg)</Text>
          {j.items.map((i, k) => <Text key={k} style={s.body}>{i.qty} × {i.name}</Text>)}
        </View>
      </ScrollView>
      <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {j.status === "ready_for_pickup" ? <Button testID="rider-pickup-button" title="Confirm pickup" loading={busy} style={{ flex: 1 }} onPress={() => run(() => api(`/rider/orders/${id}/pickup`, { method: "POST" }), "Picked up — on the way")} /> : null}
        {j.status === "out_for_delivery" ? <Button testID="rider-deliver-button" icon="shield-checkmark" title="Enter customer OTP" style={{ flex: 1 }} onPress={() => setSheet(true)} /> : null}
        {j.status === "delivered" ? <Button testID="rider-back-to-jobs" variant="secondary" title="Delivered · back to jobs" style={{ flex: 1 }} onPress={() => (router.canGoBack() ? router.back() : router.replace("/rider"))} /> : null}
      </View>
      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Verify delivery OTP" testID="rider-otp-sheet">
        <Text style={s.sub}>Ask {j.drop.name}{j.flat ? ` (Flat ${j.flat})` : ""} for the 4-digit OTP shown in their app.</Text>
        <TextInput testID="rider-otp-input" value={otp} onChangeText={(t) => setOtp(t.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={4} placeholder="0000"
          placeholderTextColor={colors.borderStrong} style={s.otp} />
        {j.collect_cash ? (
          <Pressable testID="rider-cash-collected" onPress={() => setCash(!cash)} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 44 }}>
            <Ionicons name={cash ? "checkbox" : "square-outline"} size={24} color={cash ? colors.success : colors.muted} />
            <Text style={{ flex: 1, color: colors.onSurface, fontWeight: "700" }}>I collected {rupee(j.collect_cash)} in cash</Text>
          </Pressable>
        ) : null}
        <Button testID="rider-otp-confirm" title="Mark delivered" disabled={otp.length !== 4 || (!!j.collect_cash && !cash)} loading={busy}
          onPress={async () => { if (await run(() => api(`/rider/orders/${id}/deliver`, { method: "POST", body: { otp, cash_collected: cash } }), "Delivered!")) { setSheet(false); setOtp(""); } }} />
      </Sheet>
      <LocationExplainSheet mode={loc.explain} onClose={loc.close} title="Share live location"
        body="Customers see you approach on a map and get an accurate arrival time. Shared only while you carry their order." onAllow={allowLocation} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  card: { backgroundColor: c.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: c.border, gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  h: { fontWeight: "800", color: c.onSurface, fontSize: font.base + 1 },
  body: { color: c.onSurface, fontWeight: "600" },
  sub: { color: c.muted, fontSize: font.sm + 1 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", backgroundColor: c.surface, padding: spacing.lg, borderTopWidth: 1, borderTopColor: c.border },
  otp: { height: 60, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary, textAlign: "center", fontSize: 28, letterSpacing: 12, color: c.onSurface, fontWeight: "800" },
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, padding: spacing.md, minHeight: 48 },
  navBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 48, borderTopWidth: 1, borderTopColor: c.border },
}));
