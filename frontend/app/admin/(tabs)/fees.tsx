import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { PartnerHeader } from "@/src/components/partner-header";
import { usesNativeTabs } from "@/src/navigation";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { Button, Input, Loader, useToast } from "@/src/ui";

const FIELDS: [string, string][] = [
  ["delivery_base", "Base delivery fee (₹)"], ["delivery_per_km", "Delivery fee per km (₹)"], ["free_delivery_threshold", "Free delivery above (₹, platform-funded)"],
  ["convenience_fee", "Platform convenience fee (₹)"], ["commission_pct", "Seller commission (%)"], ["community_delivery_discount", "Community delivery discount (0–0.9)"],
];

export default function AdminFees() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["admin-config"], queryFn: () => api<Record<string, any>>("/admin/config") });
  const [f, setF] = useState<Record<string, string>>({});
  const [auto, setAuto] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (q.data) { setF(Object.fromEntries(FIELDS.map(([k]) => [k, String(q.data![k] ?? "")]))); setAuto(!!q.data.seller_auto_approve); }
  }, [q.data]);

  const save = async () => {
    const bad = FIELDS.find(([k]) => f[k] === undefined || f[k].trim() === "" || isNaN(Number(f[k])));
    if (bad) return toast(`Enter a value for "${bad[1]}"`, "err");
    setBusy(true);
    try {
      await api("/admin/config", { method: "PUT", body: { ...Object.fromEntries(FIELDS.map(([k]) => [k, Number(f[k])])), seller_auto_approve: auto } });
      qc.invalidateQueries({ queryKey: ["admin-config"] });
      toast("Fees updated — new checkouts use these values");
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  };

  if (q.isLoading) return <Loader />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <PartnerHeader title="Fees & commission" subtitle="Applies to all new carts and orders" />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: (usesNativeTabs ? insets.bottom : 0) + spacing.xl }}>
        {FIELDS.map(([k, l]) => (
          <Input key={k} testID={`admin-fee-${k}`} label={l} keyboardType="decimal-pad" value={f[k] ?? ""} onChangeText={(v) => setF({ ...f, [k]: v.replace(/[^0-9.]/g, "") })} />
        ))}
        <View style={{ flexDirection: "row", alignItems: "center", padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "700", color: colors.onSurface }}>Auto-approve new shops</Text>
            <Text style={{ color: colors.muted, fontSize: font.sm }}>Off: every new shop waits for review</Text>
          </View>
          <Switch testID="admin-auto-approve-switch" value={auto} onValueChange={setAuto} trackColor={{ true: colors.success, false: colors.borderStrong }} thumbColor={colors.surface} />
        </View>
        <Button testID="admin-save-fees-button" title="Save fee rules" loading={busy} onPress={save} />
      </KeyboardAwareScrollView>
    </View>
  );
}
