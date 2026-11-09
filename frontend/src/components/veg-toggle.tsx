import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { font, radius, spacing, useTheme } from "@/src/theme";
import { VegMark } from "@/src/ui";

interface VegToggleProps {
  value: boolean; // true = Veg only, false = All / Off
  onToggle: (val: boolean) => void;
  testID?: string;
}

export function VegToggle({ value, onToggle, testID = "veg-toggle" }: VegToggleProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      testID={testID}
      onPress={() => onToggle(!value)}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: value ? colors.brandTertiary : colors.surface,
          borderColor: value ? colors.brandPrimary : colors.border,
        },
        pressed && { transform: [{ scale: 0.96 }] },
      ]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel="Veg food filter"
    >
      <Text
        style={[
          styles.label,
          {
            color: value ? colors.brandPrimary : colors.onSurfaceSecondary,
          },
        ]}
      >
        VEG
      </Text>

      {/* Switch pill with green dot indicator matching Swiggy/Zomato style */}
      <View
        style={[
          styles.switchTrack,
          {
            backgroundColor: value ? "#E6F6EE" : colors.surfaceTertiary,
            borderColor: value ? colors.success : colors.border,
            justifyContent: value ? "flex-end" : "flex-start",
          },
        ]}
      >
        <View
          style={[
            styles.switchThumb,
            {
              borderColor: value ? colors.success : colors.muted,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <View
            style={[
              styles.innerDot,
              {
                backgroundColor: value ? colors.success : "transparent",
              },
            ]}
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 48,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    minWidth: 54,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  switchTrack: {
    width: 32,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 1,
  },
  switchThumb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  innerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

