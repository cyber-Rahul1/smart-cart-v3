import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import { font, useTheme } from "@/src/theme";

interface AnimatedPlaceholderProps {
  placeholders: string[];
  interval?: number;
}

export function AnimatedPlaceholder({
  placeholders,
  interval = 2800,
}: AnimatedPlaceholderProps) {
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!placeholders || placeholders.length <= 1) return;

    const timer = setInterval(() => {
      // Animate current text up and fade out
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -14,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Switch to next text below
        setIndex((prev) => (prev + 1) % placeholders.length);
        translateY.setValue(14);
        opacity.setValue(0);

        // Animate next text in from bottom to center
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: 0,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 280,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, interval);

    return () => clearInterval(timer);
  }, [placeholders, interval, translateY, opacity]);

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.Text
        style={[
          styles.text,
          { color: colors.muted },
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
        numberOfLines={1}
      >
        {placeholders[index]}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    overflow: "hidden",
  },
  text: {
    fontSize: font.base + 1,
  },
});
