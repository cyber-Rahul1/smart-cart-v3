import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface BrandFooterProps {
  title?: string;
  subtitle?: string;
  location?: string;
}

export function BrandFooter({
  title = "Dine\nLocal!",
  location = "Visakhapatnam, India",
}: BrandFooterProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.titleText}>{title}</Text>
      <View style={styles.subRow}>
        <Text style={styles.subText}>Crafted with </Text>
        <Text style={styles.heartText}>❤️</Text>
        <Text style={styles.subText}> in {location}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "transparent",
    paddingVertical: 32,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  titleText: {
    color: "#64748B",
    opacity: 0.35,
    fontSize: 92,
    lineHeight: 84,
    fontWeight: "900",
    letterSpacing: -1.5,
    marginBottom: 14,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    opacity: 0.55,
  },
  subText: {
    color: "#64748B",
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  heartText: {
    fontSize: 13,
    marginHorizontal: 2,
  },
});
