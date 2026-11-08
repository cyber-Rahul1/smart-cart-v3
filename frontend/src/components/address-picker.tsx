import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { api } from "@/src/api";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { Address } from "@/src/types";
import { Button, Ionicons, Sheet } from "@/src/ui";

export function useAddresses() {
  return useQuery({ queryKey: ["addresses"], queryFn: () => api<Address[]>("/addresses") });
}

export function AddressPicker({ visible, onClose, selected, onSelect }: { visible: boolean; onClose: () => void; selected?: string; onSelect: (a: Address) => void }) {
  const { colors } = useTheme();
  const q = useAddresses();
  return (
    <Sheet visible={visible} onClose={onClose} title="Deliver to" testID="address-picker-sheet">
      {(q.data ?? []).map((a) => (
        <Pressable key={a.id} testID={`address-option-${a.id}`} onPress={() => { onSelect(a); onClose(); }}
          style={{ flexDirection: "row", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1,
            borderColor: selected === a.id ? colors.brandPrimary : colors.border, backgroundColor: selected === a.id ? colors.brandTertiary : colors.surface }}>
          <Ionicons name={a.label.toLowerCase() === "work" ? "briefcase-outline" : "home-outline"} size={20} color={colors.brandPrimary} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "800", color: colors.onSurface }}>{a.label}</Text>
            <Text style={{ color: colors.muted, fontSize: font.sm + 1 }}>{a.line}</Text>
          </View>
        </Pressable>
      ))}
      {q.data && q.data.length === 0 ? <Text style={{ color: colors.muted }}>No saved addresses yet.</Text> : null}
      <Button testID="address-picker-add-button" variant="secondary" icon="add" title="Add new address" onPress={() => { onClose(); router.push("/address/new"); }} />
    </Sheet>
  );
}
