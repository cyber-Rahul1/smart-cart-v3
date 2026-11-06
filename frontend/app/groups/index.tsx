import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { Button, EmptyState, ErrorState, Header, Input, Ionicons, Loader, Sheet, useToast } from "@/src/ui";

type Group = { id: string; name: string; invite_code: string; owner_id: string; members: { user_id: string; name: string }[] };
const EMPTY_IMG = "https://images.unsplash.com/photo-1547573854-74d2a71d0826?w=800&q=70";

export default function Groups() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["groups"], queryFn: () => api<Group[]>("/groups") });
  const [sheet, setSheet] = useState<"create" | "join" | null>(null);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const g = sheet === "create"
        ? await api<Group>("/groups", { method: "POST", body: { name: val.trim() } })
        : await api<Group>("/groups/join", { method: "POST", body: { code: val.trim() } });
      qc.invalidateQueries({ queryKey: ["groups"] });
      setSheet(null); setVal("");
      router.push(`/groups/${g.id}`);
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Roommate groups" subtitle="Shared carts for bachelors & flatmates" />
      {q.isLoading ? <Loader /> : q.isError ? <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} /> : (
        <FlatList
          testID="groups-list"
          data={q.data}
          keyExtractor={(g) => g.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 160 }}
          ListEmptyComponent={
            <View style={{ gap: spacing.md }}>
              <Image source={{ uri: EMPTY_IMG }} style={{ height: 180, borderRadius: radius.lg }} contentFit="cover" />
              <EmptyState testID="groups-empty" icon="people-outline" title="Order together with roommates" body="Create a group, share the code, and everyone adds their own cravings to one shared cart." />
            </View>
          }
          renderItem={({ item: g }) => (
            <Pressable testID={`group-card-${g.id}`} onPress={() => router.push(`/groups/${g.id}`)}
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.pastelLilac, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="people" size={22} color={colors.onPastelLilac} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "800", color: colors.onSurface, fontSize: font.lg }}>{g.name}</Text>
                <Text style={{ color: colors.muted, fontSize: font.sm + 1 }}>{g.members.map((m) => m.name.split(" ")[0]).join(", ")} · Code {g.invite_code}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          )}
        />
      )}
      <View style={{ position: "absolute", left: spacing.lg, right: spacing.lg, bottom: insets.bottom + spacing.lg, flexDirection: "row", gap: spacing.md }}>
        <Button testID="groups-join-button" variant="secondary" icon="enter-outline" title="Join with code" style={{ flex: 1 }} onPress={() => { setVal(""); setSheet("join"); }} />
        <Button testID="groups-create-button" icon="add" title="Create group" style={{ flex: 1 }} onPress={() => { setVal(""); setSheet("create"); }} />
      </View>
      <Sheet visible={!!sheet} onClose={() => setSheet(null)} title={sheet === "create" ? "New roommate group" : "Join a group"} testID="group-form-sheet">
        <Input testID="group-form-input" label={sheet === "create" ? "Group name" : "Invite code"} placeholder={sheet === "create" ? "Flat 4B Boys" : "e.g. 3FA9C2"}
          value={val} onChangeText={setVal} autoCapitalize={sheet === "join" ? "characters" : "words"} autoFocus />
        <Button testID="group-form-submit" title={sheet === "create" ? "Create group" : "Join group"} loading={busy} disabled={val.trim().length < 2} onPress={submit} />
      </Sheet>
    </View>
  );
}
