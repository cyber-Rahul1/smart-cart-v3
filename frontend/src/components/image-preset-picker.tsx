import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, ScrollView } from "react-native";

import { api } from "@/src/api";
import { radius, spacing, useTheme } from "@/src/theme";

export function ImagePresetPicker({ value, onChange }: { value: string; onChange: (k: string) => void }) {
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ["seller-images"], queryFn: () => api<Record<string, string>>("/seller/images") });
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
      {Object.entries(q.data ?? {}).map(([k, url]) => (
        <Pressable key={k} testID={`image-preset-${k}`} onPress={() => onChange(k)}
          style={{ borderRadius: radius.md, borderWidth: 3, borderColor: value === k ? colors.brandPrimary : "transparent" }}>
          <Image source={{ uri: url }} style={{ width: 72, height: 72, borderRadius: radius.sm }} contentFit="cover" />
        </Pressable>
      ))}
    </ScrollView>
  );
}

export const goPartner = () => router.replace("/partner");
