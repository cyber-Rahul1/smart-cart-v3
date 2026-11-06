import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Shop } from "@/src/partner";
import { useAuth } from "@/src/auth";
import { ImagePresetPicker } from "@/src/components/image-preset-picker";
import { PartnerHeader } from "@/src/components/partner-header";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { Button, Chip, Input, useToast } from "@/src/ui";

const TYPES = [
  { key: "cloud_kitchen", label: "Cloud kitchen", category: "food" },
  { key: "restaurant", label: "Restaurant", category: "food" },
  { key: "kirana", label: "Grocery / Kirana", category: "grocery" },
] as const;

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const { signOut } = useAuth();
  const [type, setType] = useState<(typeof TYPES)[number]["key"]>("cloud_kitchen");
  const [f, setF] = useState({ business_name: "", owner_name: "", cuisine: "", address: "", prep: "25", min: "99", fssai: "" });
  const [img, setImg] = useState("biryani");
  const [busy, setBusy] = useState(false);
  const category = TYPES.find((t) => t.key === type)!.category;
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const submit = async () => {
    setBusy(true);
    try {
      const shop = await api<Shop>("/seller/onboarding", { method: "POST", body: {
        business_name: f.business_name.trim(), owner_name: f.owner_name.trim(), category, business_type: type, cuisine: f.cuisine.trim(),
        address: f.address.trim(), prep_time_min: Number(f.prep || 0), min_order: Number(f.min || 0), image_key: img,
        fssai_number: category === "food" ? f.fssai.trim() : null } });
      qc.setQueryData(["seller-me"], { shop }); // cached {shop:null} would otherwise bounce the user back here
      toast("Shop submitted for review");
      router.replace("/partner");
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <PartnerHeader title="Register your business" subtitle="Takes 2 minutes · reviewed before going live" />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <Text style={{ fontWeight: "700", color: colors.onSurfaceSecondary }}>Business type</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {TYPES.map((t) => <Chip key={t.key} testID={`onboard-type-${t.key}`} label={t.label} selected={type === t.key} onPress={() => setType(t.key)} />)}
        </View>
        <Input testID="onboard-name-input" label="Business name" placeholder={category === "food" ? "Spice Route Kitchen" : "Sri Lakshmi Stores"} value={f.business_name} onChangeText={set("business_name")} />
        <Input testID="onboard-owner-input" label="Owner name" placeholder="Your full name" value={f.owner_name} onChangeText={set("owner_name")} />
        <Input testID="onboard-cuisine-input" label={category === "food" ? "Cuisines" : "What you sell"} placeholder={category === "food" ? "Biryani, North Indian" : "Staples, Dairy, Snacks"} value={f.cuisine} onChangeText={set("cuisine")} />
        <Input testID="onboard-address-input" label="Business address" placeholder="Shop 4, 1st Main, Koramangala" value={f.address} onChangeText={set("address")} multiline />
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}><Input testID="onboard-prep-input" label="Prep time (min)" keyboardType="number-pad" value={f.prep} onChangeText={(v) => set("prep")(v.replace(/\D/g, ""))} /></View>
          <View style={{ flex: 1 }}><Input testID="onboard-min-input" label="Min order (₹)" keyboardType="number-pad" value={f.min} onChangeText={(v) => set("min")(v.replace(/\D/g, ""))} /></View>
        </View>
        {category === "food" ? (
          <View style={{ gap: spacing.sm }}>
            <Input testID="onboard-fssai-input" label="FSSAI licence / registration no. (14 digits)" keyboardType="number-pad" maxLength={14} value={f.fssai} onChangeText={(v) => set("fssai")(v.replace(/\D/g, ""))} />
            <View style={{ backgroundColor: colors.pastelSky, borderRadius: radius.md, padding: spacing.md }}>
              <Text style={{ color: colors.onPastelSky, fontSize: font.sm + 1 }}>Your FSSAI number is marked "submitted". Only GathrCart's review can mark it verified. Document upload arrives with the Admin app.</Text>
            </View>
          </View>
        ) : null}
        <Text style={{ fontWeight: "700", color: colors.onSurfaceSecondary }}>Cover image</Text>
        <ImagePresetPicker value={img} onChange={setImg} />
        <Button testID="onboard-submit-button" title="Submit for review" loading={busy} onPress={submit} />
        <Button testID="onboard-logout-button" variant="ghost" title="Log out" onPress={async () => { await signOut(); router.replace("/login?partner=1"); }} />
      </KeyboardAwareScrollView>
    </View>
  );
}
