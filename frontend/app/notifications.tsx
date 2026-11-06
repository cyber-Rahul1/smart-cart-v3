import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { when } from "@/src/format";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { EmptyState, Header, IconName, Ionicons, Loader } from "@/src/ui";

type N = { id: string; title: string; body: string; type: string; ref?: string; read: boolean; created_at: string };
const ICON: Record<string, IconName> = { order: "receipt-outline", group: "people-outline", group_cart: "cart-outline", basket: "business-outline", community: "business-outline", referral: "gift-outline" };

export default function Notifications() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["notifications"], queryFn: () => api<{ unread: number; items: N[] }>("/notifications") });
  useEffect(() => {
    if (q.data?.unread) api("/notifications/read-all", { method: "POST" }).then(() => qc.invalidateQueries({ queryKey: ["notifications"] }));
  }, [q.data?.unread, qc]);

  const open = (n: N) => {
    if (!n.ref) return;
    const map: Record<string, string> = { order: `/orders/${n.ref}`, group: `/groups/${n.ref}`, group_cart: `/group-cart/${n.ref}`, basket: `/basket/${n.ref}`, community: `/community/${n.ref}` };
    if (map[n.type]) router.push(map[n.type] as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Notifications" />
      {q.isLoading ? <Loader /> : (
        <FlatList
          testID="notifications-list"
          data={q.data?.items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
          ListEmptyComponent={<EmptyState icon="notifications-outline" title="All caught up" body="Order, group cart and community updates will appear here." />}
          renderItem={({ item: n }) => (
            <Pressable testID={`notification-${n.id}`} onPress={() => open(n)} style={{ flexDirection: "row", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider,
              backgroundColor: n.read ? colors.surface : colors.brandTertiary }}>
              <View style={{ width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={ICON[n.type] ?? "notifications-outline"} size={20} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "800", color: colors.onSurface }}>{n.title}</Text>
                <Text style={{ color: colors.onSurfaceSecondary, marginTop: 2 }}>{n.body}</Text>
                <Text style={{ color: colors.muted, fontSize: font.sm, marginTop: 4 }}>{when(n.created_at)}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
