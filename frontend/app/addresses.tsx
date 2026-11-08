import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAddresses } from "@/src/components/address-picker";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { Button, EmptyState, Header, Ionicons, Loader } from "@/src/ui";

export default function Addresses() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const q = useAddresses();
  const refresh = () => qc.invalidateQueries({ queryKey: ["addresses"] });

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Saved addresses" />
      {q.isLoading ? <Loader /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}>
          {!q.data?.length ? <EmptyState testID="addresses-empty" icon="location-outline" title="No addresses yet" body="Add where you'd like your orders delivered." /> : null}
          {q.data?.map((a) => (
            <View key={a.id} testID={`address-card-${a.id}`} style={{ borderWidth: 1, borderColor: a.is_default ? colors.brandPrimary : colors.border, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Ionicons name="location" size={18} color={colors.brandPrimary} />
                <Text style={{ fontWeight: "800", color: colors.onSurface, flex: 1 }}>{a.label}{a.is_default ? "  · Default" : ""}</Text>
                <Pressable testID={`address-delete-${a.id}`} hitSlop={10} onPress={async () => { await api(`/addresses/${a.id}`, { method: "DELETE" }); refresh(); }}>
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </Pressable>
              </View>
              <Text style={{ color: colors.onSurfaceSecondary }}>{a.line}{a.landmark ? ` · ${a.landmark}` : ""}</Text>
              {!a.is_default ? (
                <Pressable testID={`address-default-${a.id}`} onPress={async () => { await api(`/addresses/${a.id}/default`, { method: "POST" }); refresh(); }}>
                  <Text style={{ color: colors.brandPrimary, fontWeight: "700", fontSize: font.sm + 1 }}>Deliver here by default</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          <Button testID="addresses-add-button" icon="add" variant="secondary" title="Add new address" onPress={() => router.push("/address/new")} />
        </ScrollView>
      )}
    </View>
  );
}
