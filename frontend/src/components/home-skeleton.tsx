import React from "react";
import { StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { SkeletonBlock } from "@/src/ui";
import { radius, spacing } from "@/src/theme";

/**
 * Modern Shimmering Skeleton Loader that mirrors the Home screen layout:
 * - Hero Cravings Banner
 * - 4-item Quick Shortcut grid
 * - Schedule Order Banner
 * - Trending Near You Horizontal Cards Carousel
 * - All Shops Near You Vertical Full Card
 *
 * Designed with translucent glassmorphic surfaces, low subtle opacity, and 0 shadows.
 */
export function HomeSkeleton() {
  return (
    <View style={styles.container}>
      {/* 1. Hero Food & Cloud Kitchens Banner Skeleton */}
      <View style={styles.heroSkeleton}>
        <SkeletonBlock width="100%" height={175} borderRadius={18} />
      </View>

      {/* 2. Four Quick Shortcut Cards Grid Skeleton */}
      <View style={styles.shortcutsGrid}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.shortcutCard}>
            <BlurView intensity={18} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={["rgba(255, 241, 245, 0.45)", "rgba(255, 222, 233, 0.25)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <SkeletonBlock width={38} height={38} borderRadius={19} />
            <SkeletonBlock width={52} height={12} borderRadius={6} style={{ marginTop: 2 }} />
            <SkeletonBlock width={64} height={9} borderRadius={4} />
          </View>
        ))}
      </View>

      {/* 3. Schedule for later Banner Skeleton */}
      <View style={styles.scheduleBanner}>
        <BlurView intensity={18} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={["rgba(240, 248, 240, 0.55)", "rgba(230, 245, 235, 0.35)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <SkeletonBlock width={38} height={38} borderRadius={10} />
        <View style={styles.scheduleDivider} />
        <View style={{ flex: 1, gap: 5 }}>
          <SkeletonBlock width="70%" height={13} borderRadius={5} />
          <SkeletonBlock width="88%" height={9} borderRadius={4} />
        </View>
        <SkeletonBlock width={84} height={28} borderRadius={14} />
      </View>

      {/* 4. Section Title Skeleton (Trending near you) */}
      <View style={styles.sectionTitleRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <SkeletonBlock width={26} height={26} borderRadius={13} />
          <View style={{ gap: 4 }}>
            <SkeletonBlock width={130} height={15} borderRadius={5} />
            <SkeletonBlock width={160} height={10} borderRadius={4} />
          </View>
        </View>
        <SkeletonBlock width={48} height={14} borderRadius={6} />
      </View>

      {/* 5. Horizontal Carousel Tiles Skeleton */}
      <View style={styles.carouselRow}>
        {[1, 2].map((i) => (
          <View key={i} style={styles.carouselCard}>
            <BlurView intensity={18} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={["rgba(255, 255, 255, 0.65)", "rgba(255, 235, 242, 0.30)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Image Box */}
            <SkeletonBlock width="100%" height={110} borderRadius={12} />
            {/* Body */}
            <View style={{ padding: 10, gap: 6 }}>
              <SkeletonBlock width="80%" height={13} borderRadius={5} />
              <SkeletonBlock width="55%" height={10} borderRadius={4} />
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                <SkeletonBlock width={42} height={11} borderRadius={4} />
                <SkeletonBlock width={46} height={11} borderRadius={4} />
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* 6. Section Title Skeleton (All shops nearby) */}
      <View style={[styles.sectionTitleRow, { marginTop: 10 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <SkeletonBlock width={26} height={26} borderRadius={13} />
          <View style={{ gap: 4 }}>
            <SkeletonBlock width={120} height={15} borderRadius={5} />
            <SkeletonBlock width={150} height={10} borderRadius={4} />
          </View>
        </View>
      </View>

      {/* 7. Vertical Full Card Skeleton */}
      <View style={styles.fullCard}>
        <BlurView intensity={18} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={["rgba(255, 255, 255, 0.65)", "rgba(255, 235, 242, 0.30)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <SkeletonBlock width="100%" height={160} borderRadius={14} />
        <View style={{ padding: 12, gap: 7 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <SkeletonBlock width="50%" height={16} borderRadius={6} />
            <SkeletonBlock width={45} height={16} borderRadius={8} />
          </View>
          <SkeletonBlock width="75%" height={11} borderRadius={4} />
          <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
            <SkeletonBlock width={60} height={12} borderRadius={4} />
            <SkeletonBlock width={55} height={12} borderRadius={4} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
    paddingBottom: 40,
    gap: 16,
  },
  heroSkeleton: {
    marginHorizontal: spacing.lg,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 220, 230, 0.5)",
  },
  shortcutsGrid: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    gap: 10,
  },
  shortcutCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 220, 230, 0.45)",
    paddingVertical: 12,
    alignItems: "center",
    gap: 5,
    overflow: "hidden",
  },
  scheduleBanner: {
    marginHorizontal: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(187, 247, 208, 0.45)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    overflow: "hidden",
  },
  scheduleDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(34, 197, 94, 0.2)",
  },
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  carouselRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: 12,
  },
  carouselCard: {
    width: 168,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 220, 230, 0.45)",
    overflow: "hidden",
    position: "relative",
  },
  fullCard: {
    marginHorizontal: spacing.lg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 220, 230, 0.45)",
    overflow: "hidden",
    position: "relative",
  },
});
