import React, { useEffect, useState } from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { api } from "@/src/api";
import { spacing } from "@/src/theme";
import { Address } from "@/src/types";
import { Ionicons } from "@/src/ui";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const GATHR_LOGO = require("@/assets/images/gathr_logo_tight.png");

interface AppSplashScreenProps {
  onAnimationComplete?: () => void;
}

export function AppSplashScreen({ onAnimationComplete }: AppSplashScreenProps) {
  const insets = useSafeAreaInsets();
  const [isRendered, setIsRendered] = useState(true);

  // Fetch address to display user's currently selected address
  const addrQuery = useQuery({
    queryKey: ["addresses"],
    queryFn: () => api<Address[]>("/addresses"),
    staleTime: 60000,
  });

  const addresses = addrQuery.data || [];
  const defaultAddress = addresses.find((a) => a.is_default) || addresses[0];
  const addressTitle = defaultAddress?.label || "Home";
  const addressLine = defaultAddress?.line
    ? defaultAddress.line.length > 34
      ? defaultAddress.line.slice(0, 34) + "..."
      : defaultAddress.line
    : "Delivering to your doorstep";

  // Coordinates
  const centerX = SCREEN_WIDTH / 2;
  const centerY = SCREEN_HEIGHT / 2 - 25;

  // Center of home header logo
  const targetX = spacing.lg + 16; // 36
  const targetY = insets.top + spacing.xs + 22; // insets.top + 30

  // Flight displacement vector
  const deltaX = targetX - centerX;
  const deltaY = targetY - centerY;

  // Reanimated UI-thread values
  const introAnim = useSharedValue(0);
  const breathAnim = useSharedValue(0);
  const flightProgress = useSharedValue(0);
  const rippleProgress = useSharedValue(0);
  const bgOpacity = useSharedValue(1);

  useEffect(() => {
    // 1. Initial Entry: smooth fade & pop
    introAnim.value = withTiming(1, {
      duration: 380,
      easing: Easing.out(Easing.cubic),
    });

    // 2. Liquid smooth breathing (UI-thread transform only)
    breathAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );

    // 3. Trigger launch & smooth fluid flight
    const timer = setTimeout(() => {
      // Start flight (480ms)
      flightProgress.value = withTiming(
        1,
        {
          duration: 480,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
        },
        (finished) => {
          if (finished) {
            runOnJS(triggerLandHaptic)();
            // Background dissolves seamlessly as soon as the logo lands
            bgOpacity.value = withTiming(0, { duration: 180 }, () => {
              runOnJS(finishSplash)();
            });
          }
        }
      );
    }, 1700);

    return () => clearTimeout(timer);
  }, []);

  const triggerLandHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const finishSplash = () => {
    setIsRendered(false);
    onAnimationComplete?.();
  };

  // Outer ambient sphere: pure transform + opacity fade
  const outerSphereStyle = useAnimatedStyle(() => {
    const fade = interpolate(flightProgress.value, [0, 0.18], [1, 0]);
    return {
      opacity: fade,
    };
  });

  // Concentric glowing aura disc: breathes smoothly and fades cleanly on takeoff
  const centerAuraStyle = useAnimatedStyle(() => {
    const fade = interpolate(flightProgress.value, [0, 0.14], [1, 0]);
    const breath = interpolate(breathAnim.value, [0, 1], [0.97, 1.05]);
    return {
      opacity: fade,
      transform: [{ scale: breath }],
    };
  });

  // Logo Animated Style:
  // Starts centered at 72x99.
  // Shrinks QUICKLY to 32x44 (by p=0.45, scale = 32/72 = 0.444).
  // Immediately disappears (opacity: 0 at p >= 0.96) so the real header logo seamlessly appears.
  const logoAnimatedStyle = useAnimatedStyle(() => {
    const p = flightProgress.value;

    if (p >= 0.96) {
      return {
        opacity: 0,
      };
    }

    const isFlying = p > 0;
    const arc = Math.sin(p * Math.PI) * -24;

    const tx = interpolate(p, [0, 1], [0, deltaX]);
    const ty = interpolate(p, [0, 1], [0, deltaY]) + arc;

    // Fast shrink from 1.0 to 0.444 (matching 32x44 size)
    const flightScale = interpolate(p, [0, 0.42, 1], [1, 0.444, 0.444]);
    const breathing = interpolate(breathAnim.value, [0, 1], [0.96, 1.05]);
    const floatY = interpolate(breathAnim.value, [0, 1], [-5, 5]);

    const finalScale = isFlying ? flightScale : breathing * introAnim.value;
    const finalTranslateY = isFlying ? ty : floatY;

    return {
      transform: [
        { translateX: tx },
        { translateY: finalTranslateY },
        { scale: finalScale },
      ],
      opacity: introAnim.value,
    };
  });

  // Traveling glow tightly accompanying the logo
  const travelingGlowStyle = useAnimatedStyle(() => {
    const p = flightProgress.value;
    if (p <= 0.02 || p >= 0.96) {
      return { opacity: 0 };
    }

    const arc = Math.sin(p * Math.PI) * -24;
    const tx = interpolate(p, [0, 1], [0, deltaX]);
    const ty = interpolate(p, [0, 1], [0, deltaY]) + arc;

    const op = interpolate(p, [0.03, 0.15, 0.8, 0.96], [0, 0.9, 0.85, 0]);
    const scale = interpolate(p, [0.03, 0.45, 1], [1, 0.5, 0.4]);

    return {
      transform: [
        { translateX: tx },
        { translateY: ty },
        { scale },
      ],
      opacity: op,
    };
  });

  // Shooting star trail behind the logo
  const starTrailStyle = useAnimatedStyle(() => {
    const p = flightProgress.value;
    if (p <= 0.04 || p >= 0.95) {
      return { opacity: 0 };
    }

    const arc = Math.sin(p * Math.PI) * -24;
    const curX = interpolate(p, [0, 1], [centerX, targetX]);
    const curY = interpolate(p, [0, 1], [centerY, targetY]) + arc;

    const angleRad = Math.atan2(deltaY, deltaX);
    const angleDeg = (angleRad * 180) / Math.PI + 180;

    const trailLen = interpolate(p, [0.06, 0.35, 0.85], [16, 48, 12]);
    const op = interpolate(p, [0.04, 0.15, 0.75, 0.95], [0, 0.95, 0.75, 0]);

    return {
      left: curX - 10,
      top: curY - 4,
      width: trailLen,
      opacity: op,
      transform: [{ rotate: `${angleDeg}deg` }],
    };
  });

  // Selected User Address Card
  const addressCardStyle = useAnimatedStyle(() => {
    const isFlying = flightProgress.value > 0;
    const introOp = interpolate(introAnim.value, [0.3, 1], [0, 1]);
    const introY = interpolate(introAnim.value, [0, 1], [16, 0]);

    const exitOp = interpolate(flightProgress.value, [0, 0.22], [1, 0]);
    const exitY = interpolate(flightProgress.value, [0, 0.22], [0, 12]);

    return {
      opacity: isFlying ? exitOp : introOp,
      transform: [{ translateY: isFlying ? exitY : introY }],
    };
  });

  // Fullscreen background dissolve
  const bgStyle = useAnimatedStyle(() => {
    return {
      opacity: bgOpacity.value,
    };
  });

  if (!isRendered) return null;

  const outerSphereSize = SCREEN_WIDTH * 1.54;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={flightProgress.value > 0.85 ? "none" : "auto"}>
      {/* 1. Fullscreen Brand Color Background (#E11D48 / #F43F5E) */}
      <Animated.View style={[s.fullscreenBg, bgStyle]}>
        {/* Giant outer sphere matching user's image */}
        <Animated.View
          style={[
            s.outerSphere,
            {
              width: outerSphereSize,
              height: outerSphereSize,
              borderRadius: outerSphereSize / 2,
              left: centerX - outerSphereSize / 2,
              top: centerY - outerSphereSize / 2,
            },
            outerSphereStyle,
          ]}
        />

        {/* Concentric bright circular glow disc centered behind the logo */}
        <Animated.View
          style={[
            s.centerAuraDisc,
            { left: centerX - 100, top: centerY - 100 },
            centerAuraStyle,
          ]}
        />

        {/* Selected User Address Card in Vertical Center */}
        <Animated.View style={[s.addressContainer, { top: centerY + 85 }, addressCardStyle]}>
          <View style={s.addressPill}>
            <View style={s.pinCircle}>
              <Ionicons
                name={
                  addressTitle.toLowerCase() === "work"
                    ? "briefcase"
                    : addressTitle.toLowerCase() === "home"
                    ? "home"
                    : "location"
                }
                size={14}
                color="#E11D48"
              />
            </View>

            <View style={s.addressTextWrap}>
              <View style={s.addressTitleRow}>
                <Text style={s.addressTitle}>{addressTitle}</Text>
                <View style={s.activeDot} />
                <Text style={s.selectedTag}>Selected</Text>
              </View>
              <Text style={s.addressLine} numberOfLines={1}>
                {addressLine}
              </Text>
            </View>
          </View>
        </Animated.View>
      </Animated.View>

      {/* 2. Traveling Glow accompanying the logo to the header */}
      <Animated.View
        style={[
          s.travelingGlow,
          { left: centerX - 45, top: centerY - 45 },
          travelingGlowStyle,
        ]}
      />

      {/* 3. Shooting Star Tail */}
      <Animated.View style={[s.starTrail, starTrailStyle]} />

      {/* 4. Cute Living Logo: GPU-accelerated translate + scale */}
      <Animated.View
        style={[
          s.logoContainer,
          { left: centerX - 36, top: centerY - 49.5 },
          logoAnimatedStyle,
        ]}
      >
        <Image
          source={GATHR_LOGO}
          style={s.logoImage}
          contentFit="contain"
          tintColor="#FFFFFF"
          priority="high"
        />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  fullscreenBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#E11D48",
    overflow: "hidden",
    zIndex: 90,
  },
  outerSphere: {
    position: "absolute",
    backgroundColor: "#F43F5E",
  },
  centerAuraDisc: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255, 255, 255, 0.28)",
    zIndex: 91,
  },
  logoContainer: {
    position: "absolute",
    width: 72,
    height: 99,
    zIndex: 100,
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  travelingGlow: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    zIndex: 96,
  },
  starTrail: {
    position: "absolute",
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    zIndex: 98,
  },
  addressContainer: {
    position: "absolute",
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 24,
    zIndex: 93,
  },
  addressPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 28,
    gap: 12,
    maxWidth: SCREEN_WIDTH - 48,
    elevation: 3,
  },
  pinCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FFE4E8",
    alignItems: "center",
    justifyContent: "center",
  },
  addressTextWrap: {
    flexShrink: 1,
    justifyContent: "center",
  },
  addressTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  addressTitle: {
    fontSize: 13.5,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#10B981",
  },
  selectedTag: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#10B981",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  addressLine: {
    fontSize: 11.5,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 1,
  },
});
