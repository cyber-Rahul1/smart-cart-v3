import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, Switch, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { PartnerHeader } from "@/src/components/partner-header";
import { PhotoPicker } from "@/src/components/photo-picker";
import { usesNativeTabs } from "@/src/navigation";
import { Shop } from "@/src/partner";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { AppImage, Button, Chip, Input, Ionicons, Loader, useToast } from "@/src/ui";
import { mediaUri } from "@/src/format";

export default function PartnerShop() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const { signOut } = useAuth();
  const q = useQuery({ queryKey: ["seller-me"], queryFn: () => api<{ shop: Shop }>("/seller/me") });
  const [f, setF] = useState({
    prep: "",
    min: "",
    offer: "",
    opens: "",
    closes: "",
    description: "",
    cuisine: "",
    phone: "",
    email: "",
    address: "",
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [fssai, setFssai] = useState("");
  const [isPureVeg, setIsPureVeg] = useState(false);
  const [gallery, setGallery] = useState<string[]>([]);
  const [highlightInput, setHighlightInput] = useState("");
  const [highlights, setHighlights] = useState<string[]>([]);
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const shop = q.data?.shop;

  useEffect(() => {
    if (shop) {
      setF({
        prep: String(shop.prep_time_min ?? 25),
        min: String(shop.min_order ?? 99),
        offer: shop.offer ?? "",
        opens: shop.opens_at ?? "09:00",
        closes: shop.closes_at ?? "22:00",
        description: shop.description ?? "",
        cuisine: shop.cuisine ?? "",
        phone: shop.contact_phone ?? "",
        email: shop.contact_email ?? "",
        address: shop.address ?? "",
      });
      setIsPureVeg(!!shop.is_pure_veg);
      setGallery(shop.gallery || []);
      setHighlights(shop.highlights || []);
      if (shop.fssai_number) setFssai(shop.fssai_number);
    }
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

  const save = () =>
    run(
      "save",
      () =>
        api("/seller/shop", {
          method: "PUT",
          body: {
            prep_time_min: Number(f.prep),
            min_order: Number(f.min),
            offer: f.offer.trim() || null,
            opens_at: f.opens,
            closes_at: f.closes,
            description: f.description.trim() || null,
            cuisine: f.cuisine.trim(),
            contact_phone: f.phone.trim() || null,
            contact_email: f.email.trim() || null,
            address: f.address.trim(),
            is_pure_veg: isPureVeg,
            highlights,
            gallery,
          },
        }),
      "Shop settings saved"
    );

  const addHighlight = () => {
    const trimmed = highlightInput.trim();
    if (trimmed && !highlights.includes(trimmed)) {
      setHighlights([...highlights, trimmed]);
      setHighlightInput("");
    }
  };

  const removeHighlight = (tag: string) => {
    setHighlights(highlights.filter((h) => h !== tag));
  };

  const removeGalleryPhoto = (index: number) => {
    const updated = [...gallery];
    updated.splice(index, 1);
    setGallery(updated);
    run("gallery-del", () => api("/seller/shop", { method: "PUT", body: { gallery: updated } }), "Photo removed");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <PartnerHeader title="Shop Profile & Settings" subtitle={`${shop.name} · ${shop.business_type.replace("_", " ")}`} />
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: bottomChrome + spacing.xl }}
      >
        {/* Verification Status Card */}
        <View style={[s.card, { backgroundColor: shop.approved ? colors.pastelMint : rejected ? colors.pastelRose : colors.pastelLemon, borderColor: "transparent" }]} testID="partner-approval-card">
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Ionicons name={shop.approved ? "checkmark-circle" : rejected ? "close-circle" : "hourglass-outline"} size={22} color={tone} />
            <Text testID="partner-approval-status" style={{ fontWeight: "800", fontSize: font.lg, color: tone }}>
              {shop.approved ? "Live for customers" : rejected ? "Not approved" : "Pending review"}
            </Text>
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
                <Input testID="partner-fssai-fix-input" label="Corrected FSSAI number (14 digits)" keyboardType="number-pad" maxLength={14} value={fssai} onChangeText={(v) => setFssai(v.replace(/\D/g, ""))} />
              ) : null}
              <Button
                testID="partner-resubmit-button"
                small
                title="Fix & resubmit for review"
                loading={busy === "resubmit"}
                onPress={() =>
                  run(
                    "resubmit",
                    async () => {
                      if (shop.category === "food" && fssai && fssai !== shop.fssai_number) await api("/seller/shop/fssai", { method: "PUT", body: { fssai_number: fssai } });
                      await api("/seller/shop/resubmit", { method: "POST" });
                    },
                    "Resubmitted for review"
                  )
                }
              />
            </View>
          ) : null}
        </View>

        {/* Store Open / Closed Switch */}
        <View style={[s.card, { flexDirection: "row", alignItems: "center" }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.h}>{shop.open ? "Accepting orders" : "Shop closed"}</Text>
            <Text style={s.sub}>Customers cannot place orders while closed</Text>
          </View>
          <Switch
            testID="partner-open-switch"
            value={shop.open}
            onValueChange={(v) => run("open", () => api("/seller/shop", { method: "PUT", body: { open: v } }))}
            trackColor={{ true: colors.success, false: colors.borderStrong }}
            thumbColor={colors.surface}
          />
        </View>

        {/* Branding & Media Section */}
        <View style={[s.card, { gap: spacing.md }]}>
          <Text style={s.h}>Store Branding & Media</Text>
          <Text style={s.sub}>These images power your storefront and Discover feed</Text>
          
          <PhotoPicker
            testID="partner-logo-photo"
            label="Upload Store Logo (Square)"
            url={shop.logo_url?.startsWith("/api/") ? shop.logo_url : null}
            onChange={(u) => u && run("logo", () => api("/seller/shop", { method: "PUT", body: { logo_url: u } }), "Store logo updated")}
          />

          <PhotoPicker
            testID="partner-cover-photo"
            label="Upload Storefront Cover Photo"
            url={shop.image?.startsWith("/api/") ? shop.image : null}
            onChange={(u) => u && run("cover", () => api("/seller/shop", { method: "PUT", body: { image_url: u } }), "Cover photo updated")}
          />

          <PhotoPicker
            testID="partner-banner-photo"
            label="Upload Discover Header Banner (Wide)"
            url={shop.banner_url?.startsWith("/api/") ? shop.banner_url : null}
            onChange={(u) => u && run("banner", () => api("/seller/shop", { method: "PUT", body: { banner_url: u } }), "Banner updated")}
          />
        </View>

        {/* Ambience & Kitchen Gallery Management */}
        <View style={[s.card, { gap: spacing.md }]}>
          <Text style={s.h}>Ambience & Food Gallery ({gallery.length} photos)</Text>
          <Text style={s.sub}>Upload photographs of your kitchen, dining area, or popular items for Discover</Text>
          
          {gallery.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {gallery.map((uri, idx) => (
                <View key={`gal-${idx}`} style={{ width: 80, height: 80, borderRadius: radius.md, overflow: "hidden", position: "relative" }}>
                  <AppImage source={{ uri: mediaUri(uri) }} style={{ width: "100%", height: "100%" }} />
                  <Pressable
                    hitSlop={8}
                    onPress={() => removeGalleryPhoto(idx)}
                    style={{ position: "absolute", top: 4, right: 4, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 10, width: 20, height: 20, alignItems: "center", justifyContent: "center" }}
                  >
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <PhotoPicker
            testID="partner-gallery-add"
            label="Add photo to gallery"
            url={null}
            onChange={(u) => {
              if (u) {
                const next = [...gallery, u];
                setGallery(next);
                run("gal-add", () => api("/seller/shop", { method: "PUT", body: { gallery: next } }), "Photo added to gallery");
              }
            }}
          />
        </View>

        {/* Business Information & Description */}
        <View style={[s.card, { gap: spacing.md }]}>
          <Text style={s.h}>Store Details & Highlights</Text>
          <Input testID="partner-cuisine-input" label="Cuisines / Categories" value={f.cuisine} onChangeText={(v) => setF({ ...f, cuisine: v })} />
          <Input
            testID="partner-desc-input"
            label="Store Description (Shown on Discover card)"
            placeholder="Authentic Biryani, meals and homely Indian dishes made with fresh ingredients."
            value={f.description}
            onChangeText={(v) => setF({ ...f, description: v })}
            multiline
          />

          {shop.category === "food" && (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.xs }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", color: colors.onSurface }}>Pure Vegetarian</Text>
                <Text style={{ color: colors.muted, fontSize: font.sm }}>Show pure veg green badge on Discover</Text>
              </View>
              <Switch value={isPureVeg} onValueChange={setIsPureVeg} trackColor={{ true: colors.success, false: colors.borderStrong }} thumbColor={colors.surface} />
            </View>
          )}

          {/* Highlights Chip Tags */}
          <View style={{ gap: spacing.xs }}>
            <Text style={{ fontWeight: "700", color: colors.onSurfaceSecondary }}>Store Highlights</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
              {highlights.map((h, i) => (
                <Chip key={`hl-${i}`} label={`${h} ✕`} selected={true} onPress={() => removeHighlight(h)} />
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
              <View style={{ flex: 1 }}>
                <Input placeholder="Add highlight (e.g. Pure Veg, Family Seating)" value={highlightInput} onChangeText={setHighlightInput} />
              </View>
              <Button title="Add" small onPress={addHighlight} />
            </View>
          </View>
        </View>

        {/* Contact & Address */}
        <View style={[s.card, { gap: spacing.md }]}>
          <Text style={s.h}>Business Contact & Address</Text>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Input testID="partner-phone-input" label="Store Phone" placeholder="+91 98765 43210" keyboardType="phone-pad" value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} />
            </View>
            <View style={{ flex: 1 }}>
              <Input testID="partner-email-input" label="Store Email" placeholder="shop@example.com" keyboardType="email-address" value={f.email} onChangeText={(v) => setF({ ...f, email: v })} />
            </View>
          </View>
          <Input testID="partner-address-input" label="Full Address" value={f.address} onChangeText={(v) => setF({ ...f, address: v })} multiline />
        </View>

        {/* Operational Timings & Prep */}
        <View style={[s.card, { gap: spacing.md }]}>
          <Text style={s.h}>Operating Timings & Fees</Text>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Input testID="partner-prep-input" label="Prep time (min)" keyboardType="number-pad" value={f.prep} onChangeText={(v) => setF({ ...f, prep: v.replace(/\D/g, "") })} />
            </View>
            <View style={{ flex: 1 }}>
              <Input testID="partner-minorder-input" label="Min order (₹)" keyboardType="number-pad" value={f.min} onChangeText={(v) => setF({ ...f, min: v.replace(/\D/g, "") })} />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Input testID="partner-opens-input" label="Opens (HH:MM)" value={f.opens} onChangeText={(v) => setF({ ...f, opens: v })} maxLength={5} />
            </View>
            <View style={{ flex: 1 }}>
              <Input testID="partner-closes-input" label="Closes (HH:MM)" value={f.closes} onChangeText={(v) => setF({ ...f, closes: v })} maxLength={5} />
            </View>
          </View>
          <Input testID="partner-offer-input" label="Promotion shown to customers" placeholder="e.g. 20% OFF on first order" value={f.offer} onChangeText={(v) => setF({ ...f, offer: v })} />
          <Button testID="partner-save-shop-button" title="Save All Changes" loading={busy === "save"} onPress={save} />
        </View>

        <Pressable testID="partner-notifications-link" onPress={() => router.push("/notifications")} style={[s.card, { flexDirection: "row", alignItems: "center", gap: spacing.md }]}>
          <Ionicons name="notifications-outline" size={20} color={colors.onSurface} />
          <Text style={[s.h, { flex: 1 }]}>Notifications</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

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
