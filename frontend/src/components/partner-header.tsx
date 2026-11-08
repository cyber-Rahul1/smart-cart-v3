import { ReactNode } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { font, spacing, useTheme } from "@/src/theme";

const BRAND: Record<string, string> = { seller: "GATHRCART PARTNER", rider: "GATHRCART RIDER", admin: "GATHRCART ADMIN" };

/** Dark role header so partner/rider/admin apps are visually distinct from the customer app. */
export function PartnerHeader({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: ReactNode; children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  return (
    <View style={{ backgroundColor: colors.surfaceInverse, paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.brandSecondary, fontWeight: "800", fontSize: font.sm, letterSpacing: 1 }}>{BRAND[user?.role ?? "seller"] ?? "GATHRCART"}</Text>
          <Text style={{ color: colors.onSurfaceInverse, fontWeight: "800", fontSize: font.xxl }} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={{ color: colors.onSurfaceInverse, opacity: 0.7, fontSize: font.sm + 1 }} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}
