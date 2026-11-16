import React from "react";
import { StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { SkeletonBlock } from "@/src/ui";
import { radius, spacing } from "@/src/theme";

/**
 * Shimmering skeleton loader for Food listing screen
 * Layout:
 * - Filter pills / toggle row
 * - 2 Full shop cards with banners, badges, ratings, and menu preview thumbnails
 */
export function FoodSkeleton() {
  return (
    <View style={styles.container}>
      {/* 1. Category chips row */}
      <View style={styles.chipsRow}>
        {[80, 95, 88, 110, 75].map((w, idx) => (
          <SkeletonBlock key={idx} width={w} height={34} borderRadius={17} />
        ))}
      </View>

      {/* 2. Shop Cards */}
      {[1, 2].map((i) => (
        <View key={i} style={styles.card}>
          <BlurView intensity={18} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={["rgba(255, 255, 255, 0.65)", "rgba(255, 235, 242, 0.30)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Card Hero Image */}
          <SkeletonBlock width="100%" height={165} borderRadius={14} />

          {/* Card Body */}
          <View style={{ padding: 12, gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <SkeletonBlock width="55%" height={16} borderRadius={6} />
              <SkeletonBlock width={48} height={18} borderRadius={9} />
            </View>
            <SkeletonBlock width="75%" height={12} borderRadius={4} />
            <View style={{ flexDirection: "row", gap: 12, marginTop: 2 }}>
              <SkeletonBlock width={70} height={12} borderRadius={4} />
              <SkeletonBlock width={60} height={12} borderRadius={4} />
              <SkeletonBlock width={80} height={12} borderRadius={4} />
            </View>

            {/* Menu Items Preview Row */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              {[1, 2, 3].map((m) => (
                <View key={m} style={{ flex: 1, gap: 5 }}>
                  <SkeletonBlock width="100%" height={68} borderRadius={10} />
                  <SkeletonBlock width="85%" height={10} borderRadius={4} />
                  <SkeletonBlock width="50%" height={10} borderRadius={4} />
                </View>
              ))}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 16,
  },
  chipsRow: {
    flexDirection: "row",
    gap: 8,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 220, 230, 0.45)",
    overflow: "hidden",
  },
});
