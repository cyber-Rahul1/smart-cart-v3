import React from "react";
import { StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { SkeletonBlock } from "@/src/ui";
import { spacing } from "@/src/theme";

/**
 * Shimmering skeleton loader for Cart page
 * Layout:
 * - Store group card with store header, 2 item rows with quantity steppers, and instructions/cutlery pills
 * - Delivery schedules pill row
 * - Bill details summary card
 */
export function CartSkeleton() {
  return (
    <View style={styles.container}>
      {/* 1. Store Card */}
      <View style={styles.card}>
        <BlurView intensity={18} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={["rgba(255, 255, 255, 0.75)", "rgba(255, 235, 242, 0.35)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Store Header */}
        <View style={styles.storeHeader}>
          <SkeletonBlock width={42} height={42} borderRadius={10} />
          <View style={{ flex: 1, gap: 5 }}>
            <SkeletonBlock width="55%" height={15} borderRadius={5} />
            <SkeletonBlock width="35%" height={11} borderRadius={4} />
          </View>
        </View>

        <View style={styles.divider} />

        {/* Item Rows */}
        {[1, 2].map((i) => (
          <View key={i} style={styles.itemRow}>
            <SkeletonBlock width={14} height={14} borderRadius={3} />
            <View style={{ flex: 1, gap: 4 }}>
              <SkeletonBlock width="65%" height={14} borderRadius={5} />
              <SkeletonBlock width={48} height={12} borderRadius={4} />
            </View>
            <SkeletonBlock width={74} height={28} borderRadius={8} />
          </View>
        ))}

        {/* Action pills row */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          <SkeletonBlock width={120} height={30} borderRadius={15} />
          <SkeletonBlock width={100} height={30} borderRadius={15} />
        </View>
      </View>

      {/* 2. Delivery schedule card */}
      <View style={styles.card}>
        <BlurView intensity={18} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={["rgba(255, 255, 255, 0.75)", "rgba(255, 235, 242, 0.35)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <SkeletonBlock width="40%" height={15} borderRadius={5} />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
          <SkeletonBlock width={110} height={32} borderRadius={16} />
          <SkeletonBlock width={90} height={32} borderRadius={16} />
        </View>
      </View>

      {/* 3. Bill details card */}
      <View style={styles.card}>
        <BlurView intensity={18} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={["rgba(255, 255, 255, 0.75)", "rgba(255, 235, 242, 0.35)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <SkeletonBlock width="45%" height={16} borderRadius={5} />
        <View style={{ gap: 8, marginTop: 4 }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <SkeletonBlock width="40%" height={12} borderRadius={4} />
              <SkeletonBlock width={48} height={12} borderRadius={4} />
            </View>
          ))}
        </View>
        <View style={styles.divider} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <SkeletonBlock width="35%" height={16} borderRadius={5} />
          <SkeletonBlock width={64} height={18} borderRadius={5} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    gap: 14,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 220, 230, 0.45)",
    padding: 14,
    gap: 10,
    overflow: "hidden",
  },
  storeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255, 220, 230, 0.4)",
    marginVertical: 4,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
});
