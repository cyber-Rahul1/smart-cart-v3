import { Ionicons } from "@react-native-vector-icons/ionicons";
import { router } from "expo-router";
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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

export { Ionicons };
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
      {loading ? <ActivityIndicator color={fg} /> : (
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

/* ---------------- States ---------------- */
export function Loader({ testID = "loading-indicator" }: { testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxl }}>
      <ActivityIndicator size="large" color={colors.brandPrimary} />
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
  const c = veg ? colors.success : colors.error;
  return (
    <View style={{ width: 14, height: 14, borderWidth: 1.5, borderColor: c, borderRadius: 3, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />
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
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: colors.scrim }} onPress={onClose} testID={`${testID}-backdrop`} />
        <View testID={testID} style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
          paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.lg, maxHeight: "88%" }}>
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
        </View>
      </KeyboardAvoidingView>
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
export function SectionTitle({ title, action, onAction, testID }: { title: string; action?: string; onAction?: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.md }}>
      <Text style={{ flex: 1, fontSize: font.lg + 1, fontWeight: "800", color: colors.onSurface, letterSpacing: -0.2 }}>{title}</Text>
      {action ? (
        <Pressable testID={testID} onPress={onAction} hitSlop={8}>
          <Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>{action}</Text>
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
