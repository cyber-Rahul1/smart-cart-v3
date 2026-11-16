import React from "react";
import { View, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { SkeletonBlock } from "@/src/ui";

export function DiscoverSkeleton() {
  return (
    <View style={styles.container}>
      {/* 1. Header Hero Banner Skeleton */}
      <View style={styles.bannerSkeleton}>
        <SkeletonBlock width="100%" height={150} borderRadius={20} />
      </View>

      {/* 2. Newly Added Shops Title Skeleton */}
      <View style={styles.titleRowSkeleton}>
        <SkeletonBlock width={180} height={20} borderRadius={6} />
        <SkeletonBlock width={80} height={16} borderRadius={6} />
      </View>

      {/* 3. Shop Card Skeleton */}
      <View style={styles.cardSkeleton}>
        <BlurView intensity={18} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={["rgba(255, 255, 255, 0.70)", "rgba(255, 235, 242, 0.30)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Banner with top badges skeleton */}
        <View style={styles.cardBannerSkeleton}>
          <SkeletonBlock width="100%" height={210} borderRadius={20} />
          <View style={styles.floatingBadgesRow}>
            <SkeletonBlock width={64} height={24} borderRadius={12} />
            <SkeletonBlock width={110} height={24} borderRadius={12} />
          </View>
        </View>

        {/* Identity row */}
        <View style={styles.cardIdentityRow}>
          <SkeletonBlock width={52} height={52} borderRadius={14} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <SkeletonBlock width={140} height={18} borderRadius={6} />
              <SkeletonBlock width={90} height={16} borderRadius={6} />
            </View>
            <SkeletonBlock width={190} height={12} borderRadius={4} />
            <SkeletonBlock width={120} height={14} borderRadius={4} />
          </View>
          <SkeletonBlock width={88} height={32} borderRadius={16} />
        </View>

        {/* Description line */}
        <View style={{ paddingHorizontal: 16, marginTop: 4, gap: 4 }}>
          <SkeletonBlock width="95%" height={12} borderRadius={4} />
          <SkeletonBlock width="70%" height={12} borderRadius={4} />
        </View>

        {/* Info pills row (36 mins | 1.5 km | Rs 30 delivery) */}
        <View style={styles.infoPillsRow}>
          <SkeletonBlock width={70} height={14} borderRadius={4} />
          <SkeletonBlock width={55} height={14} borderRadius={4} />
          <SkeletonBlock width={100} height={14} borderRadius={4} />
        </View>

        {/* Address and Call / Directions */}
        <View style={styles.addressBoxSkeleton}>
          <SkeletonBlock width={28} height={28} borderRadius={14} />
          <View style={{ flex: 1, gap: 4 }}>
            <SkeletonBlock width={60} height={12} borderRadius={4} />
            <SkeletonBlock width="80%" height={10} borderRadius={4} />
          </View>
          <SkeletonBlock width={100} height={32} borderRadius={16} />
        </View>

        {/* Ambience 4 thumbnails */}
        <View style={styles.ambienceRowSkeleton}>
          <SkeletonBlock width="23%" height={74} borderRadius={12} />
          <SkeletonBlock width="23%" height={74} borderRadius={12} />
          <SkeletonBlock width="23%" height={74} borderRadius={12} />
          <SkeletonBlock width="23%" height={74} borderRadius={12} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 16,
  },
  bannerSkeleton: {
    width: "100%",
    borderRadius: 20,
    overflow: "hidden",
  },
  titleRowSkeleton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
    marginTop: 4,
  },
  cardSkeleton: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 220, 230, 0.45)",
    paddingBottom: 16,
    gap: 10,
    overflow: "hidden",
    position: "relative",
  },
  cardBannerSkeleton: {
    position: "relative",
  },
  floatingBadgesRow: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    gap: 8,
  },
  cardIdentityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 4,
  },
  infoPillsRow: {
    flexDirection: "row",
    gap: 16,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  addressBoxSkeleton: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
    borderWidth: 1,
    borderColor: "rgba(255, 220, 230, 0.35)",
    gap: 10,
  },
  ambienceRowSkeleton: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 4,
  },
});

