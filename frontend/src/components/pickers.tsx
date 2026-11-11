import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Pressable, ScrollView, Text, View } from "react-native";

import { api } from "@/src/api";
import { TIME_PRESETS } from "@/src/format";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { Seller } from "@/src/types";
import { AppImage, Chip } from "@/src/ui";

export function SellerPicker({ value, onChange, category }: { value?: string; onChange: (s: Seller) => void; category?: "food" | "grocery" }) {
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ["sellers", category ?? "all"], queryFn: () => api<Seller[]>(category ? `/sellers?category=${category}` : "/sellers") });
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
      {(q.data ?? []).map((s) => (
        <Pressable key={s.id} testID={`seller-pick-${s.id}`} onPress={() => onChange(s)}
          style={{ width: 120, borderRadius: radius.md, borderWidth: 2, borderColor: value === s.id ? colors.brandPrimary : colors.border, padding: 6, backgroundColor: value === s.id ? colors.brandTertiary : colors.surface }}>
          <AppImage source={{ uri: s.image }} fallbackType={s.category === "grocery" ? "groceries" : "shop"} style={{ width: "100%", height: 64, borderRadius: radius.sm }} contentFit="cover" />
          <Text numberOfLines={1} style={{ fontWeight: "700", color: colors.onSurface, marginTop: 4, fontSize: font.sm + 1 }}>{s.name}</Text>
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11 }}>{s.category === "food" ? "Food" : "Grocery"} · {s.eta_min}m</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function TimePicker({ value, onChange, testPrefix, options = TIME_PRESETS }: { value: number | null; onChange: (v: number | null) => void; testPrefix: string; options?: { label: string; value: number | null }[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
      {options.map((o) => <Chip key={o.label} testID={`${testPrefix}-${o.label.replace(/\s/g, "")}`} label={o.label} selected={value === o.value} onPress={() => onChange(o.value)} />)}
    </ScrollView>
  );
}

export const DELIVERY_AFTER = [
  { label: "ASAP after close", value: null },
  { label: "+45 min", value: 45 },
  { label: "+1.5 hours", value: 90 },
  { label: "+3 hours", value: 180 },
];

export const PERM_LABELS: [string, string][] = [
  ["add_items", "Add items"], ["modify_own", "Change own items"], ["modify_others", "Change others' items"],
  ["remove_own", "Remove own items"], ["remove_others", "Remove others' items"], ["close_cart", "Close cart"], ["finalize", "Finalize & place order"],
];
