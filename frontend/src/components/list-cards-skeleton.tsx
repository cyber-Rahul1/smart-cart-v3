import React from "react";
import { StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { SkeletonBlock } from "@/src/ui";
import { spacing } from "@/src/theme";

/**
 * Shimmering skeleton loader for Groups, Community & Notifications lists
 * Matches the frosted glass card aesthetic with 0 shadows and reduced subtle opacity.
 */
export function ListCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.card}>
          <BlurView intensity={18} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={["rgba(255, 255, 255, 0.70)", "rgba(255, 235, 242, 0.30)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <SkeletonBlock width={48} height={48} borderRadius={14} />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonBlock width="65%" height={15} borderRadius={5} />
            <SkeletonBlock width="85%" height={11} borderRadius={4} />
            <SkeletonBlock width="40%" height={10} borderRadius={4} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: 12,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 220, 230, 0.45)",
    overflow: "hidden",
  },
});
