import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { PartnerHeader } from "@/src/components/partner-header";
import { PhotoPicker } from "@/src/components/photo-picker";
import { usesNativeTabs } from "@/src/navigation";
import { Shop } from "@/src/partner";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, Input, Ionicons, Loader, useToast } from "@/src/ui";

export default function PartnerShop() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const { signOut } = useAuth();
  const q = useQuery({ queryKey: ["seller-me"], queryFn: () => api<{ shop: Shop }>("/seller/me") });
  const [f, setF] = useState({ prep: "", min: "", offer: "", opens: "", closes: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [fssai, setFssai] = useState("");
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const shop = q.data?.shop;

  useEffect(() => {
    if (shop) setF({ prep: String(shop.prep_time_min), min: String(shop.min_order), offer: shop.offer ?? "", opens: shop.opens_at, closes: shop.closes_at });
    if (shop?.fssai_number) setFssai(shop.fssai_number);
  }, [shop]);

  const run = async (key: string, fn: () => Promise<any>, msg?: string) => {
    setBusy(key);
    try {
      await fn();
      qc.invalidateQueries({ queryKey: ["seller-me"] });
      if (msg) toast(msg);
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(null);
    }
  };

  if (q.isLoading || !shop) return <Loader />;
  const rejected = shop.approval_status === "rejected";
  const tone = shop.approved ? colors.onPastelMint : rejected ? colors.onPastelRose : colors.onPastelLemon;
  const save = () => run("save", () => api("/seller/shop", { method: "PUT", body: { prep_time_min: Number(f.prep), min_order: Number(f.min), offer: f.offer.trim(), opens_at: f.opens, closes_at: f.closes } }), "Shop settings saved");

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <PartnerHeader title="Shop" subtitle={`${shop.owner_name} · ${shop.business_type.replace("_", " ")}`} />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: bottomChrome + spacing.xl }}>
        <View style={[s.card, { backgroundColor: shop.approved ? colors.pastelMint : rejected ? colors.pastelRose : colors.pastelLemon, borderColor: "transparent" }]} testID="partner-approval-card">
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Ionicons name={shop.approved ? "checkmark-circle" : rejected ? "close-circle" : "hourglass-outline"} size={22} color={tone} />
            <Text testID="partner-approval-status" style={{ fontWeight: "800", fontSize: font.lg, color: tone }}>
              {shop.approved ? "Live for customers" : rejected ? "Not approved" : "Pending review"}</Text>
          </View>
          <Text style={{ color: tone, fontSize: font.sm + 1 }}>
            FSSAI: {shop.fssai_status.replace("_", " ")}{shop.fssai_number ? ` (${shop.fssai_number})` : ""}. {shop.approved ? "" : "Documents & FSSAI are reviewed by GathrCart admins before your shop goes public."}
          </Text>
          {!shop.approved ? (
            <Text style={{ color: tone, fontSize: font.sm }}>{rejected ? `Reason: ${(shop as any).review_note ?? ""}` : "You'll get a notification when it's reviewed."}</Text>
          ) : null}
          {rejected ? (
            <View style={{ gap: spacing.sm }}>
              {shop.category === "food" ? (
                <Input testID="partner-fssai-fix-input" label="Corrected FSSAI number (14 digits)" keyboardType="number-pad" maxLength={14} value={fssai}
                  onChangeText={(v) => setFssai(v.replace(/\D/g, ""))} />
              ) : null}
              <Button testID="partner-resubmit-button" small title="Fix & resubmit for review" loading={busy === "resubmit"}
                onPress={() => run("resubmit", async () => {
                  if (shop.category === "food" && fssai && fssai !== shop.fssai_number) await api("/seller/shop/fssai", { method: "PUT", body: { fssai_number: fssai } });
                  await api("/seller/shop/resubmit", { method: "POST" });
                }, "Resubmitted for review")} />
            </View>
          ) : null}
        </View>

        <View style={[s.card, { gap: spacing.md }]}>
          <Text style={s.h}>Storefront photo</Text>
          <PhotoPicker testID="partner-cover-photo" label="Upload storefront photo" url={shop.image?.startsWith("/api/") ? shop.image : null}
            onChange={(u) => u && run("cover", () => api("/seller/shop", { method: "PUT", body: { image_url: u } }), "Storefront photo updated")} />
        </View>

        <View style={[s.card, { flexDirection: "row", alignItems: "center" }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.h}>{shop.open ? "Accepting orders" : "Shop closed"}</Text>
            <Text style={s.sub}>Customers can't check out while closed</Text>
          </View>
          <Switch testID="partner-open-switch" value={shop.open} onValueChange={(v) => run("open", () => api("/seller/shop", { method: "PUT", body: { open: v } }))}
            trackColor={{ true: colors.success, false: colors.borderStrong }} thumbColor={colors.surface} />
        </View>

        <View style={[s.card, { gap: spacing.md }]}>
          <Text style={s.h}>Business settings</Text>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}><Input testID="partner-prep-input" label="Prep time (min)" keyboardType="number-pad" value={f.prep} onChangeText={(v) => setF({ ...f, prep: v.replace(/\D/g, "") })} /></View>
            <View style={{ flex: 1 }}><Input testID="partner-minorder-input" label="Min order (₹)" keyboardType="number-pad" value={f.min} onChangeText={(v) => setF({ ...f, min: v.replace(/\D/g, "") })} /></View>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}><Input testID="partner-opens-input" label="Opens (HH:MM)" value={f.opens} onChangeText={(v) => setF({ ...f, opens: v })} maxLength={5} /></View>
            <View style={{ flex: 1 }}><Input testID="partner-closes-input" label="Closes (HH:MM)" value={f.closes} onChangeText={(v) => setF({ ...f, closes: v })} maxLength={5} /></View>
          </View>
          <Input testID="partner-offer-input" label="Promotion shown to customers" placeholder="e.g. 20% OFF on first order" value={f.offer} onChangeText={(v) => setF({ ...f, offer: v })} />
          <Button testID="partner-save-shop-button" title="Save settings" loading={busy === "save"} onPress={save} />
        </View>

        <Pressable testID="partner-notifications-link" onPress={() => router.push("/notifications")} style={[s.card, { flexDirection: "row", alignItems: "center", gap: spacing.md }]}>
          <Ionicons name="notifications-outline" size={20} color={colors.onSurface} />
          <Text style={[s.h, { flex: 1 }]}>Notifications</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
        <Text style={s.sub}>Reels, campaigns, photo upload and analytics come in the next seller milestone.</Text>
        <Button testID="partner-logout-button" variant="danger" icon="log-out-outline" title="Log out" onPress={async () => { await signOut(); router.replace("/login?partner=1"); }} />
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: { backgroundColor: c.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: c.border, gap: spacing.sm },
  h: { fontWeight: "800", color: c.onSurface, fontSize: font.base + 1 },
  sub: { color: c.muted, fontSize: font.sm },
}));
