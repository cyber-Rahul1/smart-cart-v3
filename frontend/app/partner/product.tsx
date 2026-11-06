import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { ImagePresetPicker } from "@/src/components/image-preset-picker";
import { font, spacing, useTheme } from "@/src/theme";
import { Product } from "@/src/types";
import { Button, Header, Input, Loader, Sheet, useToast } from "@/src/ui";

type P = Product & { weight_kg: number };

export default function ProductForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const list = useQuery({ queryKey: ["seller-products"], queryFn: () => api<P[]>("/seller/products"), enabled: !!id });
  const imgs = useQuery({ queryKey: ["seller-images"], queryFn: () => api<Record<string, string>>("/seller/images") });
  const existing = list.data?.find((p) => p.id === id);
  const [f, setF] = useState({ name: "", price: "", category: "", description: "", stock: "50", weight: "0.5" });
  const [veg, setVeg] = useState(true);
  const [available, setAvailable] = useState(true);
  const [img, setImg] = useState("store");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (existing) {
      setF({ name: existing.name, price: String(existing.price), category: existing.category, description: existing.description ?? "",
        stock: String(existing.stock), weight: String(existing.weight_kg ?? 0.5) });
      setVeg(existing.veg); setAvailable(existing.available);
      setImg(Object.entries(imgs.data ?? {}).find(([, u]) => u === existing.image)?.[0] ?? "store");
    }
  }, [existing, imgs.data]);

  const done = () => { qc.invalidateQueries({ queryKey: ["seller-products"] }); router.back(); };
  const save = async () => {
    setBusy("save");
    try {
      const body = { name: f.name.trim(), price: Number(f.price), category: f.category.trim(), description: f.description.trim(), stock: Number(f.stock || 0),
        weight_kg: Number(f.weight || 0.5), veg, available, image_key: img };
      await api(id ? `/seller/products/${id}` : "/seller/products", { method: id ? "PUT" : "POST", body });
      toast(id ? "Item updated" : "Item added");
      done();
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(null);
    }
  };
  const del = async () => {
    setBusy("del");
    try {
      await api(`/seller/products/${id}`, { method: "DELETE" });
      setConfirmDel(false); toast("Item deleted"); done();
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(null);
    }
  };

  if (id && list.isLoading) return <Loader />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={id ? "Edit item" : "Add item"} />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <Input testID="product-name-input" label="Item name" placeholder="Chicken Dum Biryani" value={f.name} onChangeText={set("name")} />
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}><Input testID="product-price-input" label="Price (₹)" keyboardType="decimal-pad" value={f.price} onChangeText={set("price")} /></View>
          <View style={{ flex: 1 }}><Input testID="product-stock-input" label="Stock" keyboardType="number-pad" value={f.stock} onChangeText={(v) => set("stock")(v.replace(/\D/g, ""))} /></View>
        </View>
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}><Input testID="product-category-input" label="Category" placeholder="Biryani / Dairy" value={f.category} onChangeText={set("category")} /></View>
          <View style={{ flex: 1 }}><Input testID="product-weight-input" label="Pack weight (kg)" keyboardType="decimal-pad" value={f.weight} onChangeText={set("weight")} /></View>
        </View>
        <Input testID="product-description-input" label="Description (optional)" value={f.description} onChangeText={set("description")} multiline />
        {[["Vegetarian", veg, setVeg, "product-veg-switch"], ["Available to order", available, setAvailable, "product-available-switch"]].map(([l, v, fn, t]) => (
          <View key={t as string} style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ flex: 1, color: colors.onSurface, fontWeight: "600", fontSize: font.base + 1 }}>{l as string}</Text>
            <Switch testID={t as string} value={v as boolean} onValueChange={fn as (b: boolean) => void} trackColor={{ true: colors.success, false: colors.borderStrong }} thumbColor={colors.surface} />
          </View>
        ))}
        <Text style={{ fontWeight: "700", color: colors.onSurfaceSecondary }}>Image</Text>
        <ImagePresetPicker value={img} onChange={setImg} />
        <Text style={{ color: colors.muted, fontSize: font.sm }}>Uploading your own photos is not yet implemented — pick the closest image for now.</Text>
        <Button testID="product-save-button" title={id ? "Save changes" : "Add to menu"} loading={busy === "save"} onPress={save} />
        {id ? <Button testID="product-delete-button" variant="danger" title="Delete item" onPress={() => setConfirmDel(true)} /> : null}
      </KeyboardAwareScrollView>
      <Sheet visible={confirmDel} onClose={() => setConfirmDel(false)} title="Delete this item?" testID="product-delete-sheet">
        <Text style={{ color: colors.onSurfaceSecondary }}>Customers will no longer see it. Past orders are not affected.</Text>
        <Button testID="product-delete-confirm" variant="danger" title="Delete" loading={busy === "del"} onPress={del} />
      </Sheet>
    </View>
  );
}
