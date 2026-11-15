// Design tokens for GathrCart (light, warm pastel). Keys match design_guidelines.json "color".
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme, type ViewStyle, type TextStyle, type ImageStyle } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FFFFFF",
  onSurface: "#1A1A1A",
  surfaceSecondary: "#F9F9F9",
  onSurfaceSecondary: "#4A4A4A",
  surfaceTertiary: "#F0F0F0",
  onSurfaceTertiary: "#2D2D2D",
  surfaceInverse: "#222222",
  onSurfaceInverse: "#FFFFFF",
  muted: "#7A7A7A",

  brand: "#F43F5E",
  onBrand: "#FFFFFF",
  brandPrimary: "#F43F5E",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#FB7185",
  onBrandSecondary: "#1A1A1A",
  brandTertiary: "#FFF1F2",
  onBrandTertiary: "#F43F5E",

  // Pastel accents for category tiles / promo cards
  pastelMint: "#E6F6EE",
  onPastelMint: "#1E7A4C",
  pastelLilac: "#F1ECFB",
  onPastelLilac: "#5B3FA3",
  pastelSky: "#E7F2FB",
  onPastelSky: "#1F5F8B",
  pastelRose: "#FDEBEE",
  onPastelRose: "#A33A4D",
  pastelLemon: "#FFF7DB",
  onPastelLemon: "#8A6A00",

  success: "#28A745",
  onSuccess: "#FFFFFF",
  warning: "#FFC107",
  onWarning: "#1A1A1A",
  error: "#DC3545",
  onError: "#FFFFFF",
  info: "#17A2B8",
  onInfo: "#FFFFFF",

  border: "#EBEBEB",
  borderStrong: "#D6D6D6",
  divider: "#F0F0F0",
  scrim: "rgba(0,0,0,0.45)",
  inverseTint: "rgba(255,255,255,0.08)",
};

export type ThemeColors = typeof light;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 12, lg: 16, pill: 999 };
export const font = { sm: 12, base: 14, lg: 16, xl: 20, xxl: 24 };

export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };
export const colors = light;

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}
setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = (system === "light" || system === "dark") && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

export function makeStyles<T extends NamedStyles<T> | NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}


export function softShadow(c: ThemeColors, intensity = 1) {
  return {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: Math.max(1, Math.round(1.5 * intensity)) },
    shadowOpacity: 0.02 * intensity,
    shadowRadius: 3 * intensity,
    elevation: Math.max(0.5, Math.round(1 * intensity)),
  };
}

export function tileGradient(c: ThemeColors): Record<string, [string, string]> {
  return {
    brandTertiary: ["#FFF5F6", "#FFE4E6"],
    pastelMint: ["#F6FCF9", "#EBF7F1"],
    pastelLemon: ["#FFFDF5", "#FFF9E6"],
    pastelLilac: ["#FAF8FE", "#F3EEFD"],
    pastelSky: ["#F5F9FD", "#EAF3FB"],
    pastelRose: ["#FEF8F9", "#FDEEF1"],
  };
}
