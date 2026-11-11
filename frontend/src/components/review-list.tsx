import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { ReactNode, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { PartnerHeader } from "@/src/components/partner-header";
import { mediaUri } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { AppImage, Button, Chip, ChipRow, EmptyState, Input, Loader, Sheet, useToast } from "@/src/ui";

const TABS = [{ k: "pending_review", l: "Pending" }, { k: "approved", l: "Approved" }, { k: "rejected", l: "Rejected" }] as const;

/** Shared review list for shops and riders. */
export function ReviewList<T extends { id: string; image?: string }>({ kind, title, render }: { kind: "sellers" | "riders"; title: string; render: (x: T) => ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]["k"]>("pending_review");
  const [sel, setSel] = useState<T | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["admin", kind, tab], queryFn: () => api<T[]>(`/admin/${kind}?status=${tab}`) });

  const decide = async (decision: "approve" | "reject") => {
    setBusy(decision);
    try {
      await api(`/admin/${kind}/${sel!.id}/review`, { method: "POST", body: { decision, note } });
      toast(decision === "approve" ? "Approved" : "Rejected");
      setSel(null); setNote("");
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <PartnerHeader title={title} subtitle="Review documents, then approve or reject" />
      <View style={{ backgroundColor: colors.surface }}>
        <ChipRow>{TABS.map((t) => <Chip key={t.k} testID={`admin-${kind}-tab-${t.k}`} label={t.l} selected={tab === t.k} onPress={() => setTab(t.k)} />)}</ChipRow>
      </View>
      {q.isLoading ? <Loader /> : (
        <FlatList
          testID={`admin-${kind}-list`}
          data={q.data}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: (usesNativeTabs ? insets.bottom : 0) + spacing.xl }}
          ListEmptyComponent={<EmptyState icon="checkmark-done-outline" title="Nothing here" body="New applications show up in Pending." />}
          renderItem={({ item }) => (
            <Pressable testID={`admin-${kind}-item-${item.id}`} onPress={() => setSel(item)}
              style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, flexDirection: "row", gap: spacing.md }}>
              {item.image ? <AppImage source={{ uri: mediaUri(item.image) }} fallbackType="shop" style={{ width: 56, height: 56, borderRadius: radius.md }} /> : null}
              <View style={{ flex: 1, gap: 2 }}>{render(item)}</View>
            </Pressable>
          )}
        />
      )}
      <Sheet visible={!!sel} onClose={() => setSel(null)} title="Review" testID={`admin-${kind}-review-sheet`}>
        {sel ? <View style={{ gap: 4 }}>{render(sel)}</View> : null}
        <Input testID={`admin-${kind}-note-input`} label="Note (required to reject)" value={note} onChangeText={setNote} placeholder="e.g. FSSAI number doesn't match business name" />
        <Button testID={`admin-${kind}-approve`} title="Approve" icon="checkmark" loading={busy === "approve"} onPress={() => decide("approve")} />
        <Button testID={`admin-${kind}-reject`} variant="danger" title="Reject" loading={busy === "reject"} onPress={() => decide("reject")} />
      </Sheet>
    </View>
  );
}

type ShopRow = { id: string; image: string; name: string; owner_name?: string; business_type: string; category: string; cuisine: string; address: string;
  fssai_status: string; fssai_number?: string; approval_status: string; review_note?: string };

export default function AdminShops() {
  const { colors } = useTheme();
  return (
    <ReviewList<ShopRow> kind="sellers" title="Shop approvals" render={(s) => (
      <>
        <Text style={{ fontWeight: "800", color: colors.onSurface, fontSize: font.base + 1 }}>{s.name}</Text>
        <Text style={{ color: colors.muted, fontSize: font.sm }}>{s.business_type.replace("_", " ")} · {s.cuisine}{s.owner_name ? ` · Owner ${s.owner_name}` : ""}</Text>
        <Text style={{ color: colors.muted, fontSize: font.sm }}>{s.address}</Text>
        <Text testID={`admin-fssai-${s.id}`} style={{ color: s.fssai_status === "verified" ? colors.success : colors.onPastelLemon, fontWeight: "700", fontSize: font.sm }}>
          FSSAI: {s.fssai_status.replace("_", " ")}{s.fssai_number ? ` · ${s.fssai_number}` : ""}</Text>
        {s.review_note ? <Text style={{ color: colors.error, fontSize: font.sm }}>Note: {s.review_note}</Text> : null}
      </>
    )} />
  );
}
