import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { AnimatedPlaceholder } from "@/src/components/animated-placeholder";
import { SellerRow } from "@/src/components/seller-card";
import { VegToggle } from "@/src/components/veg-toggle";
import { VoiceSearchModal } from "@/src/components/voice-search-modal";
import { rupee, mediaUri } from "@/src/format";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { Product, Seller } from "@/src/types";
import { Chip, EmptyState, Ionicons, Loader, VegMark, AppImage } from "@/src/ui";

const SUGGEST_FOOD = ["Biryani", "Pizza", "Burgers", "Rolls", "Dosa", "Desserts", "Chinese", "Shawarma"];
const SUGGEST_GROCERY = ["Milk", "Bread", "Eggs", "Fresh Vegetables", "Paneer", "Butter", "Snacks & Biscuits", "Rice & Dal"];
const SUGGEST_DEFAULT = ["Biryani", "Pizza", "Milk", "Rolls", "Dosa", "Rice", "Eggs", "Burger"];

const PLACEHOLDERS_FOOD = [
  "Try 'Biryani'",
  "Try 'Pizza'",
  "Try 'Dosa'",
  "Try 'Burgers'",
  "Try 'Noodles'",
  "Try 'Desserts'",
];

const PLACEHOLDERS_GROCERY = [
  "Search for milk, bread, fruits...",
  "Try 'Fresh Vegetables'",
  "Try 'Paneer & Butter'",
  "Try 'Bread & Eggs'",
  "Try 'Snacks & Biscuits'",
  "Try 'Rice & Dal'",
];

const PLACEHOLDERS_DEFAULT = [
  "Try 'Biryani'",
  "Try 'Pizza'",
  "Try 'Milk'",
  "Try 'Sweets'",
  "Try 'Dosa'",
  "Try 'Organic Vegetables'",
  "Try 'Burger'",
];

export default function Search() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ q?: string; veg?: string; type?: string }>();
  const isGrocery = params.type === "grocery" || params.type === "groceries";
  const isFood = params.type === "food" || (!isGrocery && params.type !== undefined);

  const [text, setText] = useState(params.q ?? "");
  const [term, setTerm] = useState(params.q?.trim() ?? "");
  const [vegOnly, setVegOnly] = useState<boolean>(params.veg === "1" || params.veg === "true");
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);

  const suggestions = isGrocery ? SUGGEST_GROCERY : isFood ? SUGGEST_FOOD : SUGGEST_DEFAULT;
  const placeholders = isGrocery ? PLACEHOLDERS_GROCERY : isFood ? PLACEHOLDERS_FOOD : PLACEHOLDERS_DEFAULT;

  useEffect(() => {
    if (params.q !== undefined && params.q !== text) {
      setText(params.q);
      setTerm(params.q.trim());
    }
  }, [params.q]);

  useEffect(() => {
    const t = setTimeout(() => setTerm(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const queryUrl = `/search?q=${encodeURIComponent(term)}${vegOnly ? "&veg_only=true" : ""}${isGrocery ? "&category=grocery" : ""}`;
  const q = useQuery({
    queryKey: ["search", term, vegOnly, params.type],
    queryFn: () => api<{ sellers: Seller[]; products: Product[] }>(queryUrl),
    enabled: term.length > 0,
  });

  const handleVoiceTranscript = (spoken: string) => {
    setText(spoken);
    setTerm(spoken.trim());
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Top Header Card matching Home & Highlight search */}
      <View
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.divider,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Pressable
            testID="search-back-button"
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [
              {
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: "rgba(255, 255, 255, 0.8)",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.border,
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="arrow-back" size={20} color={colors.onSurface} />
          </Pressable>

          {/* Search bar matching Home search */}
          <View
            style={{
              flex: 1,
              height: 48,
              borderRadius: 24,
              backgroundColor: "#FFFFFF",
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              gap: spacing.sm,
              shadowColor: "#000000",
              shadowOpacity: 0.08,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 3 },
              elevation: 3,
            }}
          >
            <Ionicons name="search" size={19} color="#E11D48" />

            <View style={{ flex: 1, height: 38, justifyContent: "center", position: "relative" }}>
              {!text ? <AnimatedPlaceholder placeholders={placeholders} /> : null}
              <TextInput
                testID="search-input"
                autoFocus={!params.q}
                value={text}
                onChangeText={setText}
                cursorColor="#E11D48"
                selectionColor="#E11D48"
                style={{
                  fontSize: 14,
                  color: "#0F172A",
                  height: 38,
                  padding: 0,
                }}
                returnKeyType="search"
              />
            </View>

            {text ? (
              <Pressable testID="search-clear" onPress={() => setText("")} hitSlop={8} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            ) : null}

            {/* Mic Button */}
            <Pressable
              testID="search-voice-mic-button"
              onPress={() => setVoiceModalVisible(true)}
              hitSlop={8}
              style={({ pressed }) => [
                {
                  padding: 4,
                  alignItems: "center",
                  justifyContent: "center",
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="mic" size={20} color="#E11D48" />
            </Pressable>
          </View>

          {/* Veg / Non-veg Filter Toggle Beside Search */}
          <VegToggle
            value={vegOnly}
            onToggle={(val) => setVegOnly(val)}
            testID="search-veg-toggle"
          />
        </View>

        {/* Veg mode banner if turned on */}
        {vegOnly && (
          <View
            style={{
              marginTop: spacing.sm,
              backgroundColor: "#E8F5E9",
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: "#C8E6C9",
              paddingVertical: 8,
              paddingHorizontal: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Ionicons name="leaf" size={15} color="#15803D" />
            <Text style={{ fontSize: font.sm, color: "#166534", fontWeight: "700" }}>
              {q.isFetching ? "Filtering..." : "Veg mode on · showing veg items and shops"}
            </Text>
          </View>
        )}
      </View>

      {/* Voice Search Modal */}
      <VoiceSearchModal
        visible={voiceModalVisible}
        onClose={() => setVoiceModalVisible(false)}
        onTranscript={handleVoiceTranscript}
      />

      {/* Content */}
      {!term ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Text style={{ fontWeight: "800", color: colors.onSurface, fontSize: font.lg }}>
            Popular searches
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {suggestions.map((s) => (
              <Chip
                key={s}
                testID={`search-suggest-${s}`}
                label={s}
                icon="trending-up"
                onPress={() => setText(s)}
              />
            ))}
          </View>
        </View>
      ) : q.isLoading ? (
        <Loader />
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
        >
          {q.data && !q.data.sellers.length && !q.data.products.length ? (
            <EmptyState
              testID="search-empty"
              icon="search-outline"
              title={`No results for "${term}"${vegOnly ? " (Veg only)" : ""}`}
              body="Try a different dish, or turn off the VEG toggle to view all dishes."
            />
          ) : null}

          {/* Products / Items */}
          {q.data?.products.length ? (
            <Text
              style={{
                fontWeight: "800",
                fontSize: font.lg,
                color: colors.onSurface,
                padding: spacing.lg,
                paddingBottom: spacing.sm,
              }}
            >
              Items ({q.data.products.length})
            </Text>
          ) : null}
          {q.data?.products.map((p) => (
            <Pressable
              key={p.id}
              testID={`search-product-${p.id}`}
              onPress={() => router.push(`/seller/${p.seller_id}`)}
              style={{
                flexDirection: "row",
                gap: spacing.md,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
                alignItems: "center",
              }}
            >
              <AppImage
                source={{ uri: mediaUri(p.image) }}
                fallbackType={p.category === "grocery" || p.category === "groceries" ? "groceries" : "food"}
                style={{ width: 56, height: 56, borderRadius: radius.md }}
              />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <VegMark veg={p.veg} />
                  <Text
                    style={{ fontWeight: "700", color: colors.onSurface, flexShrink: 1 }}
                    numberOfLines={1}
                  >
                    {p.name}
                  </Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: font.sm, marginTop: 2 }}>
                  {p.seller_name} · {rupee(p.price)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ))}

          {/* Shops */}
          {q.data?.sellers.length ? (
            <Text
              style={{
                fontWeight: "800",
                fontSize: font.lg,
                color: colors.onSurface,
                padding: spacing.lg,
                paddingBottom: 0,
              }}
            >
              Shops ({q.data.sellers.length})
            </Text>
          ) : null}
          {q.data?.sellers.map((s) => (
            <SellerRow key={s.id} s={s} testID={`search-seller-${s.id}`} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
