import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, SectionList, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { PartnerHeader } from "@/src/components/partner-header";
import { rupee, mediaUri } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { Product } from "@/src/types";
import { EmptyState, ErrorState, Ionicons, Loader, useToast, VegMark } from "@/src/ui";

type P = Product & { weight_kg: number };

export default function PartnerMenu() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["seller-products"], queryFn: () => api<P[]>("/seller/products") });
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const imgs = useQuery({ queryKey: ["seller-images"], queryFn: () => api<Record<string, string>>("/seller/images") });

  const toggle = async (p: P, available: boolean) => {
    const key = Object.entries(imgs.data ?? {}).find(([, u]) => u === p.image)?.[0] ?? "store";
    try {
      await api(`/seller/products/${p.id}`, { method: "PUT", body: { name: p.name, price: p.price, category: p.category, veg: p.veg, stock: p.stock, available,
        description: p.description, image_key: key, weight_kg: p.weight_kg ?? 0.5 } });
      qc.invalidateQueries({ queryKey: ["seller-products"] });
    } catch (e: any) {
      toast(e.message, "err");
    }
  };

  const sections = Object.entries((q.data ?? []).reduce<Record<string, P[]>>((a, p) => ((a[p.category] ??= []).push(p), a), {})).map(([title, data]) => ({ title, data }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <PartnerHeader title="Menu & catalog" subtitle={`${q.data?.length ?? 0} items`}
        right={<Pressable testID="partner-add-product-button" onPress={() => router.push("/partner/product")} style={{ height: 44, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="add" size={18} color={colors.onBrandPrimary} /><Text style={{ color: colors.onBrandPrimary, fontWeight: "800" }}>Add item</Text></Pressable>} />
      {q.isLoading ? <Loader /> : q.isError ? <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} /> : (
        <SectionList
          testID="partner-menu-list"
          sections={sections}
          keyExtractor={(p) => p.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: bottomChrome + spacing.xl }}
          ListEmptyComponent={<EmptyState testID="partner-menu-empty" icon="restaurant-outline" title="Add your first item" body="Customers can order once your menu has items and your shop is approved." action="Add item" onAction={() => router.push("/partner/product")} />}
          renderSectionHeader={({ section }) => <Text style={{ fontWeight: "800", fontSize: font.lg, color: colors.onSurface, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.sm }}>{section.title}</Text>}
          renderItem={({ item: p }) => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
              <Pressable testID={`partner-product-${p.id}`} onPress={() => router.push(`/partner/product?id=${p.id}`)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <Image source={{ uri: mediaUri(p.image) }} style={{ width: 56, height: 56, borderRadius: radius.md, opacity: p.available ? 1 : 0.4 }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><VegMark veg={p.veg} /><Text style={{ fontWeight: "700", color: colors.onSurface, flexShrink: 1 }} numberOfLines={1}>{p.name}</Text></View>
                  <Text style={{ color: colors.muted, fontSize: font.sm }}>{rupee(p.price)} · Stock {p.stock}{p.stock < 10 ? " · Low" : ""}</Text>
                </View>
              </Pressable>
              <View style={{ minWidth: 52, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
                <Switch testID={`partner-product-available-${p.id}`} value={p.available} onValueChange={(v) => toggle(p, v)} trackColor={{ true: colors.success, false: colors.borderStrong }} thumbColor={colors.surface} />
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
