import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { AnimatedPlaceholder } from "@/src/components/animated-placeholder";
import { SellerRow } from "@/src/components/seller-card";
import { VegToggle } from "@/src/components/veg-toggle";
import { VoiceSearchModal } from "@/src/components/voice-search-modal";
import { rupee, mediaUri } from "@/src/format";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { Product, Seller } from "@/src/types";
import { Chip, EmptyState, Ionicons, Loader, VegMark } from "@/src/ui";

const SUGGEST = ["Biryani", "Pizza", "Milk", "Rolls", "Dosa", "Rice", "Eggs", "Burger"];
const SEARCH_PLACEHOLDERS = [
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
  const params = useLocalSearchParams<{ q?: string; veg?: string }>();

  const [text, setText] = useState(params.q ?? "");
  const [term, setTerm] = useState(params.q?.trim() ?? "");
  const [vegOnly, setVegOnly] = useState<boolean>(params.veg === "1" || params.veg === "true");
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);

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

  const queryUrl = `/search?q=${encodeURIComponent(term)}${vegOnly ? "&veg_only=true" : ""}`;
  const q = useQuery({
    queryKey: ["search", term, vegOnly],
    queryFn: () => api<{ sellers: Seller[]; products: Product[] }>(queryUrl),
    enabled: term.length > 0,
  });

  const handleVoiceTranscript = (spoken: string) => {
    setText(spoken);
    setTerm(spoken.trim());
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Top Search Bar Row */}
      <View
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.md,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.divider,
        }}
      >
        <Pressable
          testID="search-back-button"
          onPress={() => router.back()}
          style={{ width: 40, height: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>

        {/* Input box with magnifying glass, animated placeholder, divider, and mic button */}
        <View
          style={{
            flex: 1,
            height: 48,
            borderRadius: radius.md,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: spacing.md,
            gap: spacing.sm,
          }}
        >
          <Ionicons name="search" size={18} color={colors.muted} />

          <View style={{ flex: 1, height: 46, justifyContent: "center", position: "relative" }}>
            {!text ? <AnimatedPlaceholder placeholders={SEARCH_PLACEHOLDERS} /> : null}
            <TextInput
              testID="search-input"
              autoFocus={!params.q}
              value={text}
              onChangeText={setText}
              style={{
                fontSize: font.base + 1,
                color: colors.onSurface,
                height: 46,
                padding: 0,
              }}
              returnKeyType="search"
            />
          </View>

          {text ? (
            <Pressable testID="search-clear" onPress={() => setText("")}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}

          {/* Vertical divider before Mic */}
          <View style={{ width: 1, height: 22, backgroundColor: colors.border }} />

          {/* Mic Button */}
          <Pressable
            testID="search-voice-mic-button"
            onPress={() => setVoiceModalVisible(true)}
            style={({ pressed }) => [
              {
                padding: 4,
                alignItems: "center",
                justifyContent: "center",
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="mic" size={20} color={colors.brandPrimary} />
          </Pressable>
        </View>

        {/* Veg / Non-veg Filter Toggle Beside Search */}
        <VegToggle
          value={vegOnly}
          onToggle={(val) => setVegOnly(val)}
          testID="search-veg-toggle"
        />
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
            {SUGGEST.map((s) => (
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
              <Image
                source={{ uri: mediaUri(p.image) }}
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
