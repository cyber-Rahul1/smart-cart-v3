import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";

import { font, radius, spacing, useTheme } from "@/src/theme";
import { Ionicons } from "@/src/ui";

interface VegToggleProps {
  value: boolean; // true = Veg only, false = All / Off
  onToggle: (val: boolean) => void;
  testID?: string;
  height?: number;
}

export function VegToggle({ value, onToggle, testID = "home-veg-toggle", height = 48 }: VegToggleProps) {
  const { colors } = useTheme();

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(value ? 14 : 0, { duration: 160 }) }],
  }), [value]);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      aria-checked={value}
      accessibilityLabel="Veg only"
      onPress={() => onToggle(!value)}
      style={({ pressed }) => [
        styles.vegPill,
        height ? { height, borderRadius: height / 2 } : null,
        value && styles.vegPillActive,
        pressed && { transform: [{ scale: 0.96 }] },
      ]}
    >
      <Ionicons name="leaf" size={14} color="#15803D" style={{ marginRight: 2 }} />
      <Text style={styles.vegLabelText}>VEG</Text>
      
      {/* 3D Inset / Bowl Well Track */}
      <View style={[styles.trackOuterWell, value && styles.trackOuterWellActive]}>
        <Animated.View style={[styles.knob, knobStyle]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  vegPill: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.8)",
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  vegPillActive: {
    borderColor: "#22C55E",
    backgroundColor: "#F0FDF4",
  },
  vegLabelText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#15803D",
    letterSpacing: 0.5,
  },
  trackOuterWell: {
    width: 34,
    height: 20,
    borderRadius: 10,
    padding: 2,
    justifyContent: "center",
    backgroundColor: "#E2E8F0",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    overflow: "hidden",
    position: "relative",
  },
  trackOuterWellActive: {
    backgroundColor: "#16A34A",
    borderColor: "#15803D",
  },
  knob: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
