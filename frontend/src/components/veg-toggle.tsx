import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";

import { font, radius, spacing, useTheme } from "@/src/theme";

interface VegToggleProps {
  value: boolean; // true = Veg only, false = All / Off
  onToggle: (val: boolean) => void;
  testID?: string;
}

export function VegToggle({ value, onToggle, testID = "home-veg-toggle" }: VegToggleProps) {
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
        styles.veg,
        value && { borderColor: colors.success },
        pressed && { transform: [{ scale: 0.96 }] },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
        <Text style={[styles.vegLabel, value && { color: colors.success }]}>VEG</Text>
        {value ? (
          <View style={[styles.vegIconBorder, { borderColor: colors.success }]}>
            <View style={[styles.vegIconDot, { backgroundColor: colors.success }]} />
          </View>
        ) : null}
      </View>
      <View style={[styles.track, { backgroundColor: value ? colors.success : colors.borderStrong }]}>
        <Animated.View style={[styles.knob, knobStyle]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  veg: {
    height: 50,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  vegLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#7A7A7A",
    letterSpacing: 0.8,
  },
  vegIconBorder: {
    width: 10,
    height: 10,
    borderWidth: 1.2,
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  vegIconDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  track: {
    width: 32,
    height: 18,
    borderRadius: 9,
    padding: 2,
    justifyContent: "center",
  },
  knob: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
});
