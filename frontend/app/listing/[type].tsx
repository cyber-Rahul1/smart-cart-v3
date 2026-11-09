import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { FlatList, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { SellerRow } from "@/src/components/seller-card";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { Seller } from "@/src/types";
import { EmptyState, ErrorState, Header, Ionicons, Loader } from "@/src/ui";

const TITLES: Record<string, [string, string]> = {
  food: ["Food", "Restaurants & cloud kitchens near you"],
  grocery: ["Groceries", "Kirana, fresh produce & dairy"],
  new: ["Discover", "Recently opened, approved businesses"],
};

export default function Listing() {
  const { type, schedule } = useLocalSearchParams<{ type: string; schedule?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ["sellers", type], queryFn: () => api<Seller[]>(`/sellers?category=${type}`) });
  const [title, sub] = TITLES[type] ?? ["Shops", ""];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={title} subtitle={sub} />
      {schedule ? (
        <View testID="listing-schedule-banner" style={{ margin: spacing.lg, marginBottom: 0, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.pastelLilac, flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
          <Ionicons name="time-outline" size={18} color={colors.onPastelLilac} />
          <Text style={{ color: colors.onPastelLilac, flex: 1, fontSize: font.sm + 1, fontWeight: "600" }}>Add items, then choose a delivery slot in your cart.</Text>
        </View>
      ) : null}
      {q.isLoading ? <Loader /> : q.isError ? <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} /> : (
        <FlatList
          testID={`listing-${type}`}
          data={q.data}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ paddingVertical: spacing.sm, paddingBottom: insets.bottom + spacing.xl }}
          renderItem={({ item }) => (
            <View>
              <SellerRow s={item} testID={`listing-seller-${item.id}`} />
              {type === "new" ? (
                <Text style={{ marginLeft: 136, marginTop: -spacing.sm, marginBottom: spacing.sm, color: colors.onPastelMint, fontSize: font.sm, fontWeight: "700" }}>
                  Opened {new Date(item.opened_on).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {item.address}
                </Text>
              ) : null}
            </View>
          )}
          ListEmptyComponent={<EmptyState icon="storefront-outline" title="No shops here yet" body="We're onboarding more local businesses in your area." />}
        />
      )}
    </View>
  );
}
