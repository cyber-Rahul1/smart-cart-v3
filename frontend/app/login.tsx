import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth, User } from "@/src/auth";
import { ROLE_HOME } from "@/src/navigation";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, Input, useToast } from "@/src/ui";

type Role = "customer" | "seller" | "rider" | "admin";
const COPY: Record<Role, { title: string; sub: string; switch: string; icon: any }> = {
  customer: { title: "Log in or sign up", sub: "Groceries, food & shared carts from shops near you", switch: "Ordering food? Customer login", icon: "person-outline" },
  seller: { title: "GathrCart Partner login", sub: "For shopkeepers & cloud kitchens — menu, orders and packing", switch: "Own a shop or kitchen? Partner login", icon: "storefront-outline" },
  rider: { title: "Delivery partner login", sub: "Pick up packages and deliver with OTP verification", switch: "Deliver with GathrCart? Rider login", icon: "bicycle-outline" },
  admin: { title: "Admin login", sub: "Authorised GathrCart staff only", switch: "GathrCart staff? Admin login", icon: "shield-checkmark-outline" },
};

const HERO = "https://images.pexels.com/photos/18367330/pexels-photo-18367330.jpeg?auto=compress&w=900";

export default function Login() {
  const params = useLocalSearchParams<{ step?: string; partner?: string; mode?: Role }>();
  const [role, setRole] = useState<Role>(params.partner === "1" ? "seller" : params.mode && COPY[params.mode] ? params.mode : "customer");
  const [step, setStep] = useState<"phone" | "otp" | "profile">(params.step === "profile" ? "profile" : "phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { signIn, setUser, user } = useAuth();
  useEffect(() => {
    if (!user || step !== "phone") return;
    if (ROLE_HOME[user.role]) router.replace(ROLE_HOME[user.role] as any);
    else if (user.name) router.replace("/(tabs)");
  }, [user, step]);
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const otpRef = useRef<TextInputInstance>(null);

  const full = `+91${phone}`;

  const requestOtp = async () => {
    setErr(null);
    if (!/^[6-9]\d{9}$/.test(phone)) return setErr("Enter a valid 10-digit mobile number");
    setBusy(true);
    try {
      const r = await api<{ dev_code?: string }>("/auth/otp/request", { method: "POST", body: { phone: full, role }, auth: false });
      setDevCode(r.dev_code ?? null);
      setStep("otp");
      setTimeout(() => otpRef.current?.focus(), 300);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setErr(null);
    if (!/^\d{6}$/.test(code)) return setErr("Enter the 6-digit OTP");
    setBusy(true);
    try {
      const r = await api<{ access_token: string; refresh_token: string; user: User; is_new: boolean }>("/auth/otp/verify", {
        method: "POST", body: { phone: full, code, role }, auth: false,
      });
      await signIn(r, r.user);
      if (ROLE_HOME[r.user.role]) router.replace(ROLE_HOME[r.user.role] as any);
      else if (r.is_new) setStep("profile");
      else router.replace("/(tabs)");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async () => {
    setErr(null);
    if (name.trim().length < 2) return setErr("Tell us your name");
    setBusy(true);
    try {
      const u = await api<User>("/profile", { method: "PUT", body: { name: name.trim(), referral_code: ref.trim() || null } });
      setUser(u);
      toast(`Welcome to GathrCart, ${u.name.split(" ")[0]}!`);
      router.replace("/(tabs)");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.root}>
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <View style={s.hero}>
          <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={[s.heroScrim, { paddingTop: insets.top + spacing.lg }]}>
            <View style={s.logoRow}>
              <View style={s.logo}><Text style={s.logoText}>G</Text></View>
              <Text style={s.brand}>GathrCart</Text>
            </View>
            <Text style={s.tag}>Order together.{"\n"}Save together.</Text>
          </View>
        </View>

        <View style={s.card}>
          {step === "phone" && (
            <>
              <Text testID="login-title" style={s.title}>{COPY[role].title}</Text>
              <Text style={s.sub}>{COPY[role].sub}</Text>
              <View style={s.phoneRow}>
                <View style={s.cc}><Text style={s.ccText}>+91</Text></View>
                <TextInput
                  testID="login-phone-input"
                  style={s.phoneInput}
                  keyboardType="number-pad"
                  maxLength={10}
                  placeholder="Mobile number"
                  placeholderTextColor={colors.muted}
                  value={phone}
                  onChangeText={(t) => setPhone(t.replace(/\D/g, ""))}
                  onSubmitEditing={requestOtp}
                />
              </View>
              {err ? <Text testID="login-error" style={s.err}>{err}</Text> : null}
              <Button testID="login-send-otp-button" title="Continue" onPress={requestOtp} loading={busy} />
              <View style={{ gap: 2 }}>
                {(Object.keys(COPY) as Role[]).filter((k) => k !== role).map((k) => (
                  <Button key={k} testID={`login-mode-${k}`} small variant="ghost" icon={COPY[k].icon} title={COPY[k].switch} onPress={() => { setRole(k); setErr(null); }} />
                ))}
              </View>
            </>
          )}

          {step === "otp" && (
            <>
              <Text style={s.title}>Verify OTP</Text>
              <Text style={s.sub}>Sent to {full}</Text>
              {devCode ? (
                <Pressable testID="login-dev-otp-banner" onPress={() => setCode(devCode)} style={s.dev}>
                  <Text style={s.devLabel}>DEV MODE · tap to fill</Text>
                  <Text testID="login-dev-otp-code" style={s.devCode}>{devCode}</Text>
                </Pressable>
              ) : null}
              <TextInput
                ref={otpRef}
                testID="login-otp-input"
                style={[s.phoneInput, s.otp]}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="------"
                placeholderTextColor={colors.borderStrong}
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, ""))}
                onSubmitEditing={verify}
              />
              {err ? <Text testID="login-error" style={s.err}>{err}</Text> : null}
              <Button testID="login-verify-otp-button" title="Verify & continue" onPress={verify} loading={busy} />
              <Button testID="login-change-number-button" variant="ghost" title="Change number" onPress={() => { setStep("phone"); setCode(""); setErr(null); }} />
            </>
          )}

          {step === "profile" && (
            <>
              <Text style={s.title}>One last step</Text>
              <Text style={s.sub}>Your roommates and neighbours will see this name</Text>
              <Input testID="profile-name-input" label="Your name" placeholder="e.g. Rahul Sharma" value={name} onChangeText={setName} autoCapitalize="words" />
              <Input testID="profile-referral-input" label="Referral code (optional)" placeholder="GCXXXXXX" value={ref} onChangeText={setRef} autoCapitalize="characters" />
              {err ? <Text testID="login-error" style={s.err}>{err}</Text> : null}
              <Button testID="profile-save-button" title="Start ordering" onPress={saveProfile} loading={busy} />
            </>
          )}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  hero: { height: 300, backgroundColor: c.brandTertiary },
  heroScrim: { flex: 1, backgroundColor: c.scrim, paddingHorizontal: spacing.xl, justifyContent: "space-between", paddingBottom: spacing.xxl },
  logoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logo: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  logoText: { color: c.onBrandPrimary, fontWeight: "900", fontSize: font.xl },
  brand: { color: c.onSurfaceInverse, fontSize: font.xl, fontWeight: "800" },
  tag: { color: c.onSurfaceInverse, fontSize: 30, fontWeight: "800", lineHeight: 36, letterSpacing: -0.5 },
  card: { marginTop: -spacing.xl, backgroundColor: c.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl, gap: spacing.lg },
  title: { fontSize: font.xxl, fontWeight: "800", color: c.onSurface },
  sub: { fontSize: font.base, color: c.muted, marginTop: -spacing.sm },
  phoneRow: { flexDirection: "row", gap: spacing.sm },
  cc: { height: 54, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: c.surfaceTertiary, justifyContent: "center" },
  ccText: { fontSize: font.lg, fontWeight: "700", color: c.onSurface },
  phoneInput: { flex: 1, height: 54, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary,
    paddingHorizontal: spacing.lg, fontSize: font.lg + 1, color: c.onSurface, fontWeight: "600" },
  otp: { flex: 0, textAlign: "center", letterSpacing: 12, fontSize: font.xxl },
  err: { color: c.error, fontWeight: "600" },
  dev: { backgroundColor: c.pastelLemon, borderRadius: radius.md, padding: spacing.md, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  devLabel: { color: c.onPastelLemon, fontWeight: "700", fontSize: font.sm },
  devCode: { color: c.onPastelLemon, fontWeight: "900", fontSize: font.xl, letterSpacing: 4 },
}));
