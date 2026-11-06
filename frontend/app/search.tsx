import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { SellerRow } from "@/src/components/seller-card";
import { rupee } from "@/src/format";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { Product, Seller } from "@/src/types";
import { Chip, EmptyState, Ionicons, Loader } from "@/src/ui";

const SUGGEST = ["Biryani", "Pizza", "Milk", "Rolls", "Dosa", "Rice", "Eggs", "Burger"];

export default function Search() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [text, setText] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const q = useQuery({ queryKey: ["search", term], queryFn: () => api<{ sellers: Seller[]; products: Product[] }>(`/search?q=${encodeURIComponent(term)}`), enabled: term.length > 0 });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
        <Pressable testID="search-back-button" onPress={() => router.back()} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1, height: 48, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, gap: spacing.sm }}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput testID="search-input" autoFocus value={text} onChangeText={setText} placeholder="Search dishes, groceries, shops" placeholderTextColor={colors.muted}
            style={{ flex: 1, fontSize: font.base + 1, color: colors.onSurface, height: 46 }} returnKeyType="search" />
          {text ? <Pressable testID="search-clear" onPress={() => setText("")}><Ionicons name="close-circle" size={18} color={colors.muted} /></Pressable> : null}
        </View>
      </View>
      {!term ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Text style={{ fontWeight: "800", color: colors.onSurface, fontSize: font.lg }}>Popular searches</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {SUGGEST.map((s) => <Chip key={s} testID={`search-suggest-${s}`} label={s} icon="trending-up" onPress={() => setText(s)} />)}
          </View>
        </View>
      ) : q.isLoading ? <Loader /> : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
          {q.data && !q.data.sellers.length && !q.data.products.length ? <EmptyState testID="search-empty" icon="search-outline" title={`No results for "${term}"`} body="Try a different dish or shop name." /> : null}
          {q.data?.products.length ? <Text style={{ fontWeight: "800", fontSize: font.lg, color: colors.onSurface, padding: spacing.lg, paddingBottom: spacing.sm }}>Items</Text> : null}
          {q.data?.products.map((p) => (
            <Pressable key={p.id} testID={`search-product-${p.id}`} onPress={() => router.push(`/seller/${p.seller_id}`)} style={{ flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, alignItems: "center" }}>
              <Image source={{ uri: p.image }} style={{ width: 56, height: 56, borderRadius: radius.md }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", color: colors.onSurface }}>{p.name}</Text>
                <Text style={{ color: colors.muted, fontSize: font.sm }}>{p.seller_name} · {rupee(p.price)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ))}
          {q.data?.sellers.length ? <Text style={{ fontWeight: "800", fontSize: font.lg, color: colors.onSurface, padding: spacing.lg, paddingBottom: 0 }}>Shops</Text> : null}
          {q.data?.sellers.map((s) => <SellerRow key={s.id} s={s} testID={`search-seller-${s.id}`} />)}
        </ScrollView>
      )}
    </View>
  );
}
