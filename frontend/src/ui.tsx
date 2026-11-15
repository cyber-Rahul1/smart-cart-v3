import { Ionicons } from "@react-native-vector-icons/ionicons";
import { router } from "expo-router";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { useTabBarVisibility } from "@/src/context/tab-bar-visibility";
import { AppImage, FallbackType } from "@/src/components/app-image";

export { Ionicons, AppImage };
export type { FallbackType };
export type IconName = React.ComponentProps<typeof Ionicons>["name"];

/* ---------------- Button ---------------- */
export function Button({
  title, onPress, variant = "primary", loading, disabled, icon, testID, style, small,
}: {
  title: string; onPress?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger"; loading?: boolean;
  disabled?: boolean; icon?: IconName; testID?: string; style?: StyleProp<ViewStyle>; small?: boolean;
}) {
  const { colors } = useTheme();
  const bg = { primary: colors.brandPrimary, secondary: colors.brandTertiary, ghost: "transparent", danger: colors.pastelRose }[variant];
  const fg = { primary: colors.onBrandPrimary, secondary: colors.onBrandTertiary, ghost: colors.brandPrimary, danger: colors.error }[variant];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        { backgroundColor: bg, minHeight: small ? 36 : 52, borderRadius: radius.md, paddingHorizontal: small ? spacing.md : spacing.lg,
          flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}
    >
      {loading ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <SkeletonBlock width={16} height={16} borderRadius={8} style={{ backgroundColor: fg }} />
          <SkeletonBlock width={54} height={12} borderRadius={4} style={{ backgroundColor: fg }} />
        </View>
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={fg} /> : null}
          <Text style={{ color: fg, fontSize: small ? font.sm : font.lg, fontWeight: "700" }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

/* ---------------- Chip ---------------- */
export function Chip({ label, selected, onPress, testID, icon }: { label: string; selected?: boolean; onPress?: () => void; testID?: string; icon?: IconName }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={{ height: 36, flexShrink: 0, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, flexDirection: "row",
        alignItems: "center", gap: 6, borderColor: selected ? colors.brandPrimary : colors.border,
        backgroundColor: selected ? colors.brandTertiary : colors.surface }}
    >
      {icon ? <Ionicons name={icon} size={14} color={selected ? colors.brandPrimary : colors.onSurfaceSecondary} /> : null}
      <Text style={{ fontSize: font.sm + 1, fontWeight: "600", color: selected ? colors.brandPrimary : colors.onSurfaceSecondary }}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  const { setPagerScrollEnabled } = useTabBarVisibility();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      nestedScrollEnabled
      onTouchStart={() => setPagerScrollEnabled(false)}
      onTouchEnd={() => setPagerScrollEnabled(true)}
      onScrollBeginDrag={() => setPagerScrollEnabled(false)}
      onScrollEndDrag={() => setPagerScrollEnabled(true)}
      onMomentumScrollEnd={() => setPagerScrollEnabled(true)}
      style={{ flexGrow: 0, height: 56 }}
      contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" }}
    >
      {children}
    </ScrollView>
  );
}

/* ---------------- Input ---------------- */
export function Input({ label, testID, style, ...rest }: TextInputProps & { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={{ fontSize: font.sm, fontWeight: "600", color: colors.onSurfaceSecondary }}>{label}</Text> : null}
      <TextInput
        testID={testID}
        placeholderTextColor={colors.muted}
        style={[{ minHeight: 50, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
          paddingHorizontal: spacing.lg, fontSize: font.lg, color: colors.onSurface }, style]}
        {...rest}
      />
    </View>
  );
}

/* ---------------- Header ---------------- */
export function Header({ title, subtitle, right, back = true }: { title: string; subtitle?: string; right?: ReactNode; back?: boolean }) {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
      {back ? (
        <Pressable testID="header-back-button" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={s.iconBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={s.headerSub} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/* ---------------- Shimmering Skeleton Loader ---------------- */
export function SkeletonBlock({
  width,
  height,
  borderRadius = radius.sm,
  style,
}: {
  width?: number | `${number}%` | "auto";
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.85],
  });

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: colors.borderStrong || "#E2E5E9",
          opacity,
        },
        style,
      ]}
    />
  );
}

/* ---------------- Modern Shimmering Skeleton Page Loader ---------------- */
export function Loader({
  testID = "loading-indicator",
  type = "default",
}: {
  testID?: string;
  type?: "default" | "list" | "cards";
}) {
  const { colors } = useTheme();

  return (
    <View
      testID={testID}
      style={{
        flex: 1,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xl,
        gap: spacing.lg,
        backgroundColor: colors.surface,
      }}
    >
      {/* Top Banner / Hero Skeleton */}
      <View style={{ gap: spacing.sm }}>
        <SkeletonBlock height={140} borderRadius={radius.lg} />
      </View>

      {/* Row of Avatar / Pill Chips Skeleton */}
      <View style={{ flexDirection: "row", gap: spacing.md, overflow: "hidden" }}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ alignItems: "center", gap: 6 }}>
            <SkeletonBlock width={54} height={54} borderRadius={27} />
            <SkeletonBlock width={48} height={10} borderRadius={4} />
          </View>
        ))}
      </View>

      {/* Repeating List Item Cards */}
      <View style={{ gap: spacing.md, marginTop: spacing.xs }}>
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              gap: spacing.md,
              alignItems: "center",
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.surfaceSecondary,
            }}
          >
            <SkeletonBlock width={64} height={64} borderRadius={radius.md} />
            <View style={{ flex: 1, gap: 8 }}>
              <SkeletonBlock width="75%" height={14} borderRadius={4} />
              <SkeletonBlock width="45%" height={10} borderRadius={4} />
              <SkeletonBlock width="30%" height={12} borderRadius={4} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function EmptyState({ icon, title, body, action, onAction, testID }: { icon: IconName; title: string; body?: string; action?: string; onAction?: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ alignItems: "center", padding: spacing.xxl, gap: spacing.md }}>
      <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={40} color={colors.brandPrimary} />
      </View>
      <Text style={{ fontSize: font.xl, fontWeight: "800", color: colors.onSurface, textAlign: "center" }}>{title}</Text>
      {body ? <Text style={{ fontSize: font.base, color: colors.muted, textAlign: "center", lineHeight: 20 }}>{body}</Text> : null}
      {action ? <Button testID={`${testID}-action`} title={action} onPress={onAction} style={{ alignSelf: "stretch", marginTop: spacing.sm }} /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <EmptyState testID="error-state" icon="cloud-offline-outline" title="Couldn't load this" body={message} action="Retry" onAction={onRetry} />;
}

/* ---------------- Veg dot ---------------- */
export function VegMark({ veg }: { veg?: boolean }) {
  const { colors } = useTheme();
  if (veg) {
    return (
      <View style={{ width: 14, height: 14, borderWidth: 1.2, borderColor: "#16A34A", borderRadius: 3, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#16A34A" }} />
      </View>
    );
  }
  // Non-veg mark: brown/red triangle inside border matching Food Delivery standard
  return (
    <View style={{ width: 14, height: 14, borderWidth: 1.2, borderColor: "#B91C1C", borderRadius: 3, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" }}>
      <View style={{
        width: 0,
        height: 0,
        backgroundColor: "transparent",
        borderStyle: "solid",
        borderLeftWidth: 3.5,
        borderRightWidth: 3.5,
        borderBottomWidth: 6,
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
        borderBottomColor: "#B91C1C",
      }} />
    </View>
  );
}

/* ---------------- Qty stepper ---------------- */
export function Stepper({ qty, onChange, testID, disabled }: { qty: number; onChange: (q: number) => void; testID: string; disabled?: boolean }) {
  const { colors } = useTheme();
  if (qty === 0) {
    return (
      <Pressable testID={`${testID}-add`} disabled={disabled} onPress={() => onChange(1)}
        style={{ minWidth: 84, height: 36, borderRadius: radius.sm + 2, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
          alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : 1 }}>
        <Text style={{ color: colors.success, fontWeight: "800", fontSize: font.base }}>ADD</Text>
      </Pressable>
    );
  }
  return (
    <View style={{ minWidth: 96, height: 36, borderRadius: radius.sm + 2, backgroundColor: colors.pastelMint, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Pressable testID={`${testID}-dec`} disabled={disabled} onPress={() => onChange(qty - 1)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 4 }} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="remove" size={16} color={colors.onPastelMint} />
      </Pressable>
      <Text testID={`${testID}-qty`} style={{ fontWeight: "800", color: colors.onPastelMint }}>{qty}</Text>
      <Pressable testID={`${testID}-inc`} disabled={disabled} onPress={() => onChange(qty + 1)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 6 }} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="add" size={16} color={colors.onPastelMint} />
      </Pressable>
    </View>
  );
}

/* ---------------- Bill row ---------------- */
export function BillRow({ label, value, bold, accent, testID }: { label: string; value: string; bold?: boolean; accent?: boolean; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
      <Text style={{ color: bold ? colors.onSurface : colors.onSurfaceSecondary, fontWeight: bold ? "800" : "500", fontSize: bold ? font.lg : font.base }}>{label}</Text>
      <Text testID={testID} style={{ color: accent ? colors.success : colors.onSurface, fontWeight: bold ? "800" : "600", fontSize: bold ? font.lg : font.base }}>{value}</Text>
    </View>
  );
}

/* ---------------- Bottom sheet ---------------- */
export function Sheet({ visible, onClose, title, children, testID }: { visible: boolean; onClose: () => void; title: string; children: ReactNode; testID?: string }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [showModal, setShowModal] = useState(visible);
  const slideAnim = useRef(new Animated.Value(600)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 600,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowModal(false);
      });
    }
  }, [visible]);

  if (!showModal) return null;

  return (
    <Modal visible={showModal} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        {/* Dimmed backdrop fades in directly behind the sheet */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.scrim, opacity: fadeAnim },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} testID={`${testID}-backdrop`} />
        </Animated.View>

        <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
          <Pressable style={{ flex: 1 }} onPress={onClose} />
          {/* Sheet slides up from the bottom */}
          <Animated.View
            testID={testID}
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: insets.bottom + spacing.lg,
              maxHeight: "88%",
              transform: [{ translateY: slideAnim }],
            }}
          >
            <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md }} />
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
              <Text style={{ flex: 1, fontSize: font.xl, fontWeight: "800", color: colors.onSurface }}>{title}</Text>
              <Pressable testID={`${testID}-close`} onPress={onClose} hitSlop={10} style={{ width: 44, height: 44, alignItems: "flex-end", justifyContent: "center" }}>
                <Ionicons name="close" size={24} color={colors.onSurfaceSecondary} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
              {children}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* ---------------- Toast ---------------- */
type ToastT = { msg: string; kind: "ok" | "err" };
const ToastCtx = createContext<(msg: string, kind?: "ok" | "err") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<ToastT | null>(null);
  const op = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const show = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    setT({ msg, kind });
    Animated.timing(op, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => Animated.timing(op, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setT(null)), 2600);
  }, [op]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t ? (
        <Animated.View pointerEvents="none" testID="toast-message"
          style={{ position: "absolute", left: spacing.lg, right: spacing.lg, top: insets.top + spacing.sm, opacity: op,
            backgroundColor: t.kind === "err" ? colors.error : colors.surfaceInverse, borderRadius: radius.md, padding: spacing.md,
            flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
          <Ionicons name={t.kind === "err" ? "alert-circle" : "checkmark-circle"} size={20} color={colors.onSurfaceInverse} />
          <Text style={{ color: colors.onSurfaceInverse, fontWeight: "600", flex: 1 }}>{t.msg}</Text>
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  );
}

/* ---------------- Section title ---------------- */
export function SectionTitle({
  title,
  subtitle,
  icon,
  iconBg,
  iconColor,
  action,
  onAction,
  testID,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  iconBg?: string;
  iconColor?: string;
  action?: string;
  onAction?: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md }}>
      {icon ? (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: iconBg || "#FCE7F3",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 10,
          }}
        >
          <Ionicons name={icon as any} size={20} color={iconColor || "#F43F5E"} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 17, fontWeight: "900", color: "#0F172A", letterSpacing: -0.3 }}>{title}</Text>
        {subtitle ? (
          <Text style={{ fontSize: 12, fontWeight: "500", color: "#64748B", marginTop: 2 }}>{subtitle}</Text>
        ) : null}
      </View>
      {action ? (
        <Pressable
          testID={testID}
          onPress={onAction}
          hitSlop={8}
          style={({ pressed }) => [
            {
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              borderWidth: 1.2,
              borderColor: "rgba(255, 255, 255, 0.9)",
              overflow: "hidden",
              position: "relative",
              shadowColor: "#F43F5E",
              shadowOpacity: 0.05,
              shadowRadius: 5,
              shadowOffset: { width: 0, height: 1.5 },
            },
            pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] },
          ]}
        >
          {/* Frosted Liquid Glass Base for See All */}
          <BlurView
            intensity={20}
            tint="light"
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={["rgba(255, 255, 255, 0.75)", "rgba(255, 235, 242, 0.35)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={{ color: "#F43F5E", fontWeight: "800", fontSize: 12 }}>{action}</Text>
          <Ionicons name="arrow-forward" size={13} color="#F43F5E" />
        </Pressable>
      ) : null}
    </View>
  );
}

/* ---------------- End of List Indicator ---------------- */
export function EndOfListIndicator({ message = "You've reached the end of the list" }: { message?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.xs }}>
      <View style={{ width: 32, height: 3, borderRadius: 1.5, backgroundColor: colors.borderStrong, marginBottom: spacing.xs }} />
      <Text style={{ fontSize: font.sm, color: colors.muted, fontWeight: "600", textAlign: "center" }}>
        {message}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    backgroundColor: c.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: font.xl - 2, fontWeight: "800", color: c.onSurface },
  headerSub: { fontSize: font.sm, color: c.muted, marginTop: 2 },
}));
