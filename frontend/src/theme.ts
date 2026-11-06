// Design tokens for GathrCart (light, warm pastel). Keys match design_guidelines.json "color".
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

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

  brand: "#FC8019",
  onBrand: "#FFFFFF",
  brandPrimary: "#FC8019",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#FFA85C",
  onBrandSecondary: "#1A1A1A",
  brandTertiary: "#FFF0E5",
  onBrandTertiary: "#FC8019",

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
};

export type ThemeColors = typeof light;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };
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

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
