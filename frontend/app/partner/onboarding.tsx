import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Switch, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Shop } from "@/src/partner";
import { useAuth } from "@/src/auth";
import { ImagePresetPicker } from "@/src/components/image-preset-picker";
import { PartnerHeader } from "@/src/components/partner-header";
import { PhotoPicker } from "@/src/components/photo-picker";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { Button, Chip, Input, useToast } from "@/src/ui";

const TYPES = [
  { key: "restaurant", label: "Restaurant", category: "food" },
  { key: "cloud_kitchen", label: "Cloud kitchen", category: "food" },
  { key: "kirana", label: "Kirana store", category: "grocery" },
  { key: "supermarket", label: "Supermarket", category: "grocery" },
] as const;

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const { signOut } = useAuth();
  const [type, setType] = useState<(typeof TYPES)[number]["key"]>("restaurant");
  const [f, setF] = useState({
    business_name: "",
    owner_name: "",
    cuisine: "",
    description: "",
    phone: "",
    email: "",
    address: "",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560034",
    prep: "25",
    min: "99",
    fssai: "",
    gstin: "",
    pan: "",
    opens_at: "09:00",
    closes_at: "22:00",
  });
  const [isPureVeg, setIsPureVeg] = useState(false);
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
  const [logoPhoto, setLogoPhoto] = useState<string | null>(null);
  const [bannerPhoto, setBannerPhoto] = useState<string | null>(null);
  const [fssaiDoc, setFssaiDoc] = useState<string | null>(null);
  const [imgPreset, setImgPreset] = useState("biryani");
  const [busy, setBusy] = useState(false);

  const category = TYPES.find((t) => t.key === type)!.category;
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const validate = () => {
    if (!f.business_name.trim()) return "Enter business name";
    if (!f.owner_name.trim()) return "Enter owner name";
    if (!f.cuisine.trim()) return category === "food" ? "Enter cuisines" : "Enter categories / items sold";
    if (!f.address.trim()) return "Enter business address";
    if (category === "food") {
      if (!f.fssai.trim() || f.fssai.trim().length !== 14) return "Enter valid 14-digit FSSAI number";
    }
    return null;
  };

  const submit = async () => {
    const err = validate();
    if (err) {
      toast(err, "err");
      return;
    }
    setBusy(true);
    try {
      const fullAddress = `${f.address.trim()}, ${f.city.trim()}, ${f.state.trim()} - ${f.pincode.trim()}`;
      const payload: any = {
        business_name: f.business_name.trim(),
        owner_name: f.owner_name.trim(),
        category,
        business_type: type,
        cuisine: f.cuisine.trim(),
        description: f.description.trim() || `${f.business_name.trim()} · authentic ${f.cuisine.trim()}`,
        contact_phone: f.phone.trim() || undefined,
        contact_email: f.email.trim() || undefined,
        address: fullAddress,
        prep_time_min: Number(f.prep || 25),
        min_order: Number(f.min || 99),
        is_pure_veg: isPureVeg,
        image_key: imgPreset,
        image_url: coverPhoto || undefined,
        logo_url: logoPhoto || undefined,
        banner_url: bannerPhoto || coverPhoto || undefined,
        gallery: [coverPhoto, bannerPhoto].filter(Boolean),
        fssai_number: category === "food" ? f.fssai.trim() : null,
        fssai_doc_url: fssaiDoc || undefined,
        gstin: f.gstin.trim() || undefined,
        pan: f.pan.trim() || undefined,
        opens_at: f.opens_at || "09:00",
        closes_at: f.closes_at || "22:00",
      };

      const shop = await api<Shop>("/seller/onboarding", { method: "POST", body: payload });
      qc.setQueryData(["seller-me"], { shop });
      toast("Shop submitted for review!");
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
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
      >
        <Text style={{ fontWeight: "700", color: colors.onSurfaceSecondary }}>Business type</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {TYPES.map((t) => (
            <Chip key={t.key} testID={`onboard-type-${t.key}`} label={t.label} selected={type === t.key} onPress={() => setType(t.key)} />
          ))}
        </View>

        <Input
          testID="onboard-name-input"
          label="Business name"
          placeholder={category === "food" ? "Spice Route Kitchen" : "Sri Lakshmi Stores"}
          value={f.business_name}
          onChangeText={set("business_name")}
        />
        <Input testID="onboard-owner-input" label="Owner / Authorized Person" placeholder="Your full name" value={f.owner_name} onChangeText={set("owner_name")} />
        
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Input testID="onboard-phone-input" label="Business phone" placeholder="+91 98765 43210" keyboardType="phone-pad" value={f.phone} onChangeText={set("phone")} />
          </View>
          <View style={{ flex: 1 }}>
            <Input testID="onboard-email-input" label="Business email" placeholder="shop@example.com" keyboardType="email-address" value={f.email} onChangeText={set("email")} />
          </View>
        </View>

        <Input
          testID="onboard-cuisine-input"
          label={category === "food" ? "Cuisines & Specialties" : "Categories & Items Sold"}
          placeholder={category === "food" ? "Biryani, North Indian, Mughlai" : "Staples, Dairy, Snacks, Provisions"}
          value={f.cuisine}
          onChangeText={set("cuisine")}
        />

        <Input
          testID="onboard-desc-input"
          label="Short Business Description"
          placeholder="Authentic dishes made with farm-fresh ingredients..."
          value={f.description}
          onChangeText={set("description")}
          multiline
        />

        {category === "food" && (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.xs }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "700", color: colors.onSurface }}>Pure Vegetarian</Text>
              <Text style={{ color: colors.muted, fontSize: font.sm }}>Show pure veg green badge on Discover</Text>
            </View>
            <Switch value={isPureVeg} onValueChange={setIsPureVeg} trackColor={{ true: colors.success, false: colors.borderStrong }} thumbColor={colors.surface} />
          </View>
        )}

        <Text style={{ fontWeight: "700", color: colors.onSurfaceSecondary, marginTop: spacing.xs }}>Location & Address</Text>
        <Input
          testID="onboard-address-input"
          label="Street address / Shop No."
          placeholder="Shop 4, 1st Main, 5th Block, Koramangala"
          value={f.address}
          onChangeText={set("address")}
          multiline
        />
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Input testID="onboard-city-input" label="City" value={f.city} onChangeText={set("city")} />
          </View>
          <View style={{ flex: 1 }}>
            <Input testID="onboard-pincode-input" label="PIN Code" keyboardType="number-pad" maxLength={6} value={f.pincode} onChangeText={set("pincode")} />
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Input testID="onboard-prep-input" label="Prep time (min)" keyboardType="number-pad" value={f.prep} onChangeText={(v) => set("prep")(v.replace(/\D/g, ""))} />
          </View>
          <View style={{ flex: 1 }}>
            <Input testID="onboard-min-input" label="Min order (₹)" keyboardType="number-pad" value={f.min} onChangeText={(v) => set("min")(v.replace(/\D/g, ""))} />
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Input testID="onboard-opens-input" label="Opens at (HH:MM)" value={f.opens_at} onChangeText={set("opens_at")} maxLength={5} />
          </View>
          <View style={{ flex: 1 }}>
            <Input testID="onboard-closes-input" label="Closes at (HH:MM)" value={f.closes_at} onChangeText={set("closes_at")} maxLength={5} />
          </View>
        </View>

        {category === "food" ? (
          <View style={{ gap: spacing.sm }}>
            <Input
              testID="onboard-fssai-input"
              label="FSSAI licence / registration no. (14 digits)"
              keyboardType="number-pad"
              maxLength={14}
              value={f.fssai}
              onChangeText={(v) => set("fssai")(v.replace(/\D/g, ""))}
            />
            <PhotoPicker testID="onboard-fssai-doc" label="Upload FSSAI Certificate (Optional)" url={fssaiDoc} onChange={setFssaiDoc} />
            <View style={{ backgroundColor: colors.pastelSky, borderRadius: radius.md, padding: spacing.md }}>
              <Text style={{ color: colors.onPastelSky, fontSize: font.sm + 1 }}>
                Your FSSAI number is submitted for admin review. Verified status will appear after platform approval.
              </Text>
            </View>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <Input testID="onboard-gstin-input" label="GSTIN (Optional)" placeholder="29AAAAA0000A1Z5" value={f.gstin} onChangeText={set("gstin")} />
            <Input testID="onboard-pan-input" label="Business PAN (Optional)" placeholder="ABCDE1234F" value={f.pan} onChangeText={set("pan")} />
          </View>
        )}

        <Text style={{ fontWeight: "700", color: colors.onSurfaceSecondary }}>Business Media & Branding</Text>
        <PhotoPicker testID="onboard-logo" label="Upload Business Logo (Square)" url={logoPhoto} onChange={setLogoPhoto} />
        <PhotoPicker testID="onboard-cover" label="Upload Custom Cover Photo" url={coverPhoto} onChange={setCoverPhoto} />
        <PhotoPicker testID="onboard-banner" label="Upload Discover Banner (Optional)" url={bannerPhoto} onChange={setBannerPhoto} />

        <Text style={{ fontWeight: "700", color: colors.onSurfaceSecondary }}>Or Choose Cover Preset</Text>
        <ImagePresetPicker value={imgPreset} onChange={setImgPreset} />

        <Button testID="onboard-submit-button" title="Submit for review" loading={busy} onPress={submit} />
        <Button
          testID="onboard-logout-button"
          variant="ghost"
          title="Log out"
          onPress={async () => {
            await signOut();
            router.replace("/login?partner=1");
          }}
        />
      </KeyboardAwareScrollView>
    </View>
  );
}
