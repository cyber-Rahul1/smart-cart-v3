import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { Button, EmptyState, ErrorState, Header, Input, Ionicons, Loader, Sheet, useToast } from "@/src/ui";

type Comm = { id: string; name: string; address: string; invite_code: string; my_flat: string; is_admin: boolean; resident_count: number; flats: string[] };
const COVER = "https://images.unsplash.com/photo-1515263487990-61b07816b324?w=900&q=70";

export default function Communities() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["communities"], queryFn: () => api<Comm[]>("/communities") });
  const [sheet, setSheet] = useState<"create" | "join" | null>(null);
  const [f, setF] = useState({ name: "", address: "", flats: "101, 102, 103, 104, 201, 202, 203, 204", my_flat: "", code: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const submit = async () => {
    setBusy(true);
    try {
      const c = sheet === "create"
        ? await api<Comm>("/communities", { method: "POST", body: { name: f.name, address: f.address, flats: f.flats, my_flat: f.my_flat } })
        : await api<Comm>("/communities/join", { method: "POST", body: { code: f.code, flat: f.my_flat } });
      qc.invalidateQueries({ queryKey: ["communities"] });
      setSheet(null);
      router.push(`/community/${c.id}`);
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Apartment community" subtitle="Order with neighbours · separate bills per flat" />
      {q.isLoading ? <Loader /> : q.isError ? <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} /> : (
        <FlatList
          testID="communities-list"
          data={q.data}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 160 }}
          ListEmptyComponent={
            <View style={{ gap: spacing.md }}>
              <Image source={{ uri: COVER }} style={{ height: 180, borderRadius: radius.lg }} contentFit="cover" />
              <EmptyState testID="communities-empty" icon="business-outline" title="Start your community order" body="Register your apartment or join with a code from your community admin. Every flat gets its own order, bill and package." />
            </View>
          }
          renderItem={({ item: c }) => (
            <Pressable testID={`community-card-${c.id}`} onPress={() => router.push(`/community/${c.id}`)} style={{ borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
              <Image source={{ uri: COVER }} style={{ height: 96 }} contentFit="cover" />
              <View style={{ padding: spacing.lg, flexDirection: "row", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "800", fontSize: font.lg, color: colors.onSurface }}>{c.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: font.sm + 1 }}>Flat {c.my_flat} · {c.resident_count} residents{c.is_admin ? " · Admin" : ""}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </View>
            </Pressable>
          )}
        />
      )}
      <View style={{ position: "absolute", left: spacing.lg, right: spacing.lg, bottom: insets.bottom + spacing.lg, flexDirection: "row", gap: spacing.md }}>
        <Button testID="community-join-button" variant="secondary" icon="enter-outline" title="Join" style={{ flex: 1 }} onPress={() => setSheet("join")} />
        <Button testID="community-create-button" icon="add" title="Register" style={{ flex: 1 }} onPress={() => setSheet("create")} />
      </View>
      <Sheet visible={!!sheet} onClose={() => setSheet(null)} title={sheet === "create" ? "Register apartment" : "Join community"} testID="community-form-sheet">
        {sheet === "create" ? (
          <>
            <Input testID="community-name-input" label="Community name" placeholder="Green Meadows Apartments" value={f.name} onChangeText={set("name")} />
            <Input testID="community-address-input" label="Address" placeholder="80 Ft Road, Koramangala" value={f.address} onChangeText={set("address")} />
            <Input testID="community-flats-input" label="Flat numbers (comma separated)" value={f.flats} onChangeText={set("flats")} multiline />
          </>
        ) : (
          <Input testID="community-code-input" label="Community code" placeholder="APTXXXXXX" value={f.code} onChangeText={set("code")} autoCapitalize="characters" />
        )}
        <Input testID="community-myflat-input" label="Your flat" placeholder="101" value={f.my_flat} onChangeText={set("my_flat")} autoCapitalize="characters" />
        <Button testID="community-form-submit" title={sheet === "create" ? "Register community" : "Join community"} loading={busy} onPress={submit} />
      </Sheet>
    </View>
  );
}
