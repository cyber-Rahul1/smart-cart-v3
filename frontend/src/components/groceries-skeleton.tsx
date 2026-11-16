import React from "react";
import { StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { SkeletonBlock } from "@/src/ui";
import { radius, spacing } from "@/src/theme";

/**
 * Shimmering skeleton loader for Groceries page
 * Layout:
 * - Top Hero Banner
 * - Feature pills row (Quick Delivery, Great Offers, etc.)
 * - Section header (Categories)
 * - 2x2 Grid of product cards
 * - Section header (Grocery stores near you)
 * - Horizontal store tiles
 */
export function GroceriesSkeleton() {
  return (
    <View style={styles.container}>
      {/* 1. Hero Banner */}
      <View style={styles.banner}>
        <SkeletonBlock width="100%" height={175} borderRadius={18} />
      </View>

      {/* 2. Feature strip */}
      <View style={styles.featureStrip}>
        <BlurView intensity={18} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={["rgba(255, 255, 255, 0.70)", "rgba(240, 253, 244, 0.40)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flex: 1, alignItems: "center", gap: 4 }}>
            <SkeletonBlock width={22} height={22} borderRadius={11} />
            <SkeletonBlock width={48} height={10} borderRadius={4} />
          </View>
        ))}
      </View>

      {/* 3. Section Title */}
      <View style={styles.sectionRow}>
        <SkeletonBlock width={140} height={18} borderRadius={6} />
      </View>

      {/* 4. Product Cards 2x2 Grid */}
      <View style={styles.productGrid}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.productCard}>
            <BlurView intensity={18} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={["rgba(255, 255, 255, 0.70)", "rgba(240, 253, 244, 0.30)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <SkeletonBlock width="100%" height={100} borderRadius={12} />
            <View style={{ padding: 8, gap: 5 }}>
              <SkeletonBlock width="80%" height={12} borderRadius={4} />
              <SkeletonBlock width="50%" height={10} borderRadius={4} />
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                <SkeletonBlock width={38} height={13} borderRadius={4} />
                <SkeletonBlock width={54} height={24} borderRadius={12} />
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* 5. Stores section */}
      <View style={[styles.sectionRow, { marginTop: 10 }]}>
        <SkeletonBlock width={160} height={18} borderRadius={6} />
      </View>
      <View style={styles.storesRow}>
        {[1, 2].map((i) => (
          <View key={i} style={styles.storeTile}>
            <BlurView intensity={18} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={["rgba(255, 255, 255, 0.70)", "rgba(255, 240, 245, 0.30)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <SkeletonBlock width="100%" height={100} borderRadius={12} />
            <View style={{ padding: 8, gap: 4 }}>
              <SkeletonBlock width="75%" height={12} borderRadius={4} />
              <SkeletonBlock width="50%" height={10} borderRadius={4} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: 40,
    gap: 14,
  },
  banner: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(220, 252, 231, 0.5)",
  },
  featureStrip: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(220, 252, 231, 0.45)",
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  sectionRow: {
    paddingHorizontal: 4,
    marginTop: 4,
  },
  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  productCard: {
    width: "48%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(220, 252, 231, 0.45)",
    overflow: "hidden",
  },
  storesRow: {
    flexDirection: "row",
    gap: 12,
  },
  storeTile: {
    width: 160,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 220, 230, 0.45)",
    overflow: "hidden",
  },
});
