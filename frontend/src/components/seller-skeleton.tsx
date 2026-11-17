import React from "react";
import { Dimensions, Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SkeletonBlock } from "@/src/ui";
import { spacing } from "@/src/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_HEIGHT = 400;
const INITIAL_CARD_TOP = 275;

/**
 * Shimmering skeletal loader for Seller / Store screen matching the new UI perfectly:
 * 1. Store Hero image banner
 * 2. Floating Title Card with avatar, name, rating badge, cuisine, distance & eta
 * 3. Horizontal category capsule filter bar
 * 4. Section headers with item count
 * 5. 3-column product grid cards with image, veg badge, title, price, and Add pill
 */
export function SellerSkeleton() {
  const insets = useSafeAreaInsets();
  const cardW = (SCREEN_WIDTH - 24 - 16) / 3;

  return (
    <View style={styles.container}>
      {/* 1. Hero banner placeholder */}
      <View style={styles.heroBox}>
        <SkeletonBlock width="100%" height={HERO_HEIGHT} borderRadius={0} />

        {/* Floating circular back and share buttons */}
        <View style={[styles.circleBtn, { top: insets.top + spacing.xs, left: 16 }]}>
          <SkeletonBlock width={38} height={38} borderRadius={19} />
        </View>
        <View style={[styles.circleBtn, { top: insets.top + spacing.xs, right: 16 }]}>
          <SkeletonBlock width={38} height={38} borderRadius={19} />
        </View>

        {/* 2. Floating Resizable Title Card */}
        <View style={[styles.floatingCard, { top: INITIAL_CARD_TOP }]}>
          <BlurView intensity={Platform.OS === "ios" ? 25 : 12} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={["rgba(255, 255, 255, 0.95)", "rgba(255, 245, 248, 0.85)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Row: Store info + Rating badge */}
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1, gap: 6 }}>
              <SkeletonBlock width="70%" height={22} borderRadius={6} />
              <SkeletonBlock width="45%" height={13} borderRadius={4} />
            </View>
            <SkeletonBlock width={48} height={24} borderRadius={8} />
          </View>

          {/* Meta snippet row (time, distance, offers) */}
          <View style={styles.metaSnippetRow}>
            <SkeletonBlock width={64} height={13} borderRadius={4} />
            <SkeletonBlock width={54} height={13} borderRadius={4} />
            <SkeletonBlock width={80} height={13} borderRadius={4} />
          </View>

          {/* Safety / Verification badge */}
          <View style={{ marginTop: 10 }}>
            <SkeletonBlock width="85%" height={18} borderRadius={6} />
          </View>
        </View>
      </View>

      {/* 3. Category Capsule bar */}
      <View style={styles.categoryCapsuleWrap}>
        <View style={styles.categoryPillsRow}>
          {[72, 86, 92, 80, 88].map((w, i) => (
            <SkeletonBlock key={i} width={w} height={32} borderRadius={16} />
          ))}
        </View>
      </View>

      {/* 4. Section Header */}
      <View style={styles.sectionHeaderRow}>
        <SkeletonBlock width={140} height={18} borderRadius={5} />
        <SkeletonBlock width={24} height={24} borderRadius={12} />
      </View>

      {/* 5. 3-Column Product Grid */}
      <View style={styles.gridContainer}>
        {[1, 2, 3, 4, 5, 6].map((idx) => (
          <View key={idx} style={[styles.gridCard, { width: cardW }]}>
            <BlurView intensity={Platform.OS === "ios" ? 18 : 8} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={["rgba(255, 245, 248, 0.75)", "rgba(255, 230, 238, 0.52)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            {/* Product image */}
            <SkeletonBlock width="100%" height={cardW * 0.9} borderRadius={14} />

            {/* Details */}
            <View style={{ padding: 6, gap: 5 }}>
              <SkeletonBlock width="90%" height={11} borderRadius={3} />
              <SkeletonBlock width="50%" height={12} borderRadius={3} />
              <View style={{ alignItems: "flex-end", marginTop: 2 }}>
                <SkeletonBlock width={54} height={24} borderRadius={10} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  heroBox: {
    width: "100%",
    height: HERO_HEIGHT,
    position: "relative",
  },
  circleBtn: {
    position: "absolute",
    zIndex: 10,
  },
  floatingCard: {
    position: "absolute",
    left: 12,
    right: 12,
    borderRadius: 22,
    padding: 16,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.9)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  metaSnippetRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginTop: 10,
  },
  categoryCapsuleWrap: {
    marginTop: 40,
    paddingHorizontal: 12,
  },
  categoryPillsRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 18,
    marginBottom: 10,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 8,
  },
  gridCard: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.18)",
    padding: 3,
  },
});
