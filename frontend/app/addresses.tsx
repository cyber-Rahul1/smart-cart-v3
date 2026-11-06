import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAddresses } from "@/src/components/address-picker";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { Button, Chip, EmptyState, Header, Input, Ionicons, Loader, Sheet, useToast } from "@/src/ui";

export default function Addresses() {
  const { add } = useLocalSearchParams<{ add?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useAddresses();
  const [open, setOpen] = useState(!!add);
  const [label, setLabel] = useState("Home");
  const [line, setLine] = useState("");
  const [landmark, setLandmark] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["addresses"] });
  const save = async () => {
    if (line.trim().length < 5) return toast("Enter the full address", "err");
    setBusy(true);
    try {
      await api("/addresses", { method: "POST", body: { label, line: line.trim(), landmark: landmark.trim(), is_default: true } });
      refresh(); setOpen(false); setLine(""); setLandmark("");
      toast("Address saved");
      if (add && router.canGoBack()) router.back();
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  };

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
          <Button testID="addresses-add-button" icon="add" variant="secondary" title="Add new address" onPress={() => setOpen(true)} />
        </ScrollView>
      )}
      <Sheet visible={open} onClose={() => setOpen(false)} title="New address" testID="address-form-sheet">
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {["Home", "Work", "PG", "Other"].map((l) => <Chip key={l} testID={`address-label-${l}`} label={l} selected={label === l} onPress={() => setLabel(l)} />)}
        </View>
        <Input testID="address-line-input" label="Flat / house, street, area" placeholder="Flat 302, Green Meadows, Koramangala 5th Block" value={line} onChangeText={setLine} multiline />
        <Input testID="address-landmark-input" label="Landmark (optional)" placeholder="Near Forum Mall" value={landmark} onChangeText={setLandmark} />
        <Text style={{ color: colors.muted, fontSize: font.sm }}>Map pin & GPS location arrive with native maps in a later milestone.</Text>
        <Button testID="address-save-button" title="Save address" loading={busy} onPress={save} />
      </Sheet>
    </View>
  );
}
