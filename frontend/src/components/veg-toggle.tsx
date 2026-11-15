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

export function VegToggle({ value, onToggle, testID = "home-veg-toggle", height = 46 }: VegToggleProps) {
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
      {/* Backdrop blur layer for liquid glass */}
      <BlurView
        intensity={20}
        tint="light"
        style={StyleSheet.absoluteFill}
      />

      {/* Mint green liquid glass gradient tint */}
      <LinearGradient
        colors={[
          value ? "rgba(220, 252, 231, 0.55)" : "rgba(240, 253, 244, 0.45)",
          value ? "rgba(187, 247, 208, 0.40)" : "rgba(220, 248, 228, 0.25)",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Specular glass highlight reflection along top edge */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 12,
          right: 12,
          height: 1,
          backgroundColor: "rgba(255, 255, 255, 0.8)",
        }}
      />

      <Ionicons name="leaf" size={14} color="#15803D" style={{ marginRight: 2 }} />
      <Text style={styles.vegLabelText}>VEG</Text>
      
      {/* 3D Inset / Bowl Well Track */}
      <View style={[styles.trackOuterWell, value && styles.trackOuterWellActive]}>
        {/* Inner Top Shadow for Concave Bowl Depth */}
        <LinearGradient
          colors={
            value
              ? ["rgba(20, 83, 45, 0.45)", "rgba(22, 101, 52, 0.15)", "transparent"]
              : ["rgba(15, 23, 42, 0.22)", "rgba(100, 116, 139, 0.08)", "transparent"]
          }
          style={StyleSheet.absoluteFill}
        />
        {/* Bottom Specular Lip Highlight */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: 0,
            left: 3,
            right: 3,
            height: 1,
            backgroundColor: value ? "rgba(255, 255, 255, 0.35)" : "rgba(255, 255, 255, 0.9)",
          }}
        />
        <Animated.View style={[styles.knob, knobStyle]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  vegPill: {
    height: 46,
    borderRadius: 23,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.85)",
    overflow: "hidden",
    position: "relative",
    backgroundColor: "rgba(240, 253, 244, 0.35)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#15803D",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  vegPillActive: {
    borderColor: "rgba(134, 239, 172, 0.9)",
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
    backgroundColor: "rgba(203, 213, 225, 0.70)",
    borderWidth: 1.2,
    borderColor: "rgba(148, 163, 184, 0.45)",
    overflow: "hidden",
    position: "relative",
  },
  trackOuterWellActive: {
    backgroundColor: "#15803D",
    borderColor: "#166534",
  },
  knob: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1.5 },
    elevation: 3,
  },
});
