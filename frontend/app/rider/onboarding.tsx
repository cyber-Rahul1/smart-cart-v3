import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { PartnerHeader } from "@/src/components/partner-header";
import { spacing, useTheme } from "@/src/theme";
import { Button, Chip, Input, useToast } from "@/src/ui";

const VEHICLES = [{ k: "bike", l: "Bike · 4 pkgs / 12kg" }, { k: "scooter", l: "Scooter · 5 / 15kg" }, { k: "cycle", l: "Cycle · 2 / 5kg" }] as const;

export default function RiderOnboarding() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const { signOut } = useAuth();
  const [vehicle, setVehicle] = useState<"bike" | "scooter" | "cycle">("bike");
  const [f, setF] = useState({ name: "", vehicle_number: "", licence_number: "" });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const rider = await api("/rider/onboarding", { method: "POST", body: { ...f, vehicle } });
      // tabs layout is unmounted here, so invalidate alone leaves stale {rider:null} -> redirect loop back to onboarding
      qc.setQueryData(["rider-me"], { rider });
      qc.invalidateQueries({ queryKey: ["rider-me"] });
      toast("Submitted for verification");
      router.replace("/rider");
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <PartnerHeader title="Become a delivery partner" subtitle="Admins verify your licence before you go online" />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <Input testID="rider-name-input" label="Full name" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} />
        <Text style={{ fontWeight: "700", color: colors.onSurfaceSecondary }}>Vehicle (sets your carrying capacity)</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {VEHICLES.map((v) => <Chip key={v.k} testID={`rider-vehicle-${v.k}`} label={v.l} selected={vehicle === v.k} onPress={() => setVehicle(v.k)} />)}
        </View>
        <Input testID="rider-vehicle-number-input" label="Vehicle number" placeholder="KA01AB1234" autoCapitalize="characters" value={f.vehicle_number} onChangeText={(v) => setF({ ...f, vehicle_number: v })} />
        <Input testID="rider-licence-input" label="Driving licence number" placeholder="KA0120230001234" autoCapitalize="characters" value={f.licence_number} onChangeText={(v) => setF({ ...f, licence_number: v })} />
        <Button testID="rider-onboard-submit" title="Submit for verification" loading={busy} onPress={submit} />
        <Button testID="rider-onboard-logout" variant="ghost" title="Log out" onPress={async () => { await signOut(); router.replace("/login?mode=rider"); }} />
      </KeyboardAwareScrollView>
    </View>
  );
}
