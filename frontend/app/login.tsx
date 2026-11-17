import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { api } from "@/src/api";
import { useAuth, User } from "@/src/auth";
import { ROLE_HOME } from "@/src/navigation";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, Input, Ionicons, IconName, useToast } from "@/src/ui";

type Role = "customer" | "seller" | "rider" | "admin";

const COPY: Record<
  Role,
  {
    badgeLabel: string;
    badgeIcon: IconName;
    title: string;
    sub: string;
    switch: string;
    switchIcon: IconName;
  }
> = {
  customer: {
    badgeLabel: "Customer",
    badgeIcon: "person-outline",
    title: "Gathr Login",
    sub: "Groceries, food & shared carts from shops near you",
    switch: "Customer login",
    switchIcon: "person-outline",
  },
  seller: {
    badgeLabel: "Partner",
    badgeIcon: "storefront-outline",
    title: "Gathr Partner Login",
    sub: "For shopkeepers & cloud kitchens — menu, orders and packing",
    switch: "Partner login",
    switchIcon: "storefront-outline",
  },
  rider: {
    badgeLabel: "Rider",
    badgeIcon: "bicycle-outline",
    title: "Gathr Rider Login",
    sub: "Pick up packages and deliver with OTP verification",
    switch: "Rider login",
    switchIcon: "bicycle-outline",
  },
  admin: {
    badgeLabel: "Admin",
    badgeIcon: "shield-checkmark-outline",
    title: "Gathr Staff Login",
    sub: "Authorised Gathr staff only",
    switch: "Admin login",
    switchIcon: "shield-checkmark-outline",
  },
};

const LOGIN_BG = require("@/assets/images/login_bg.jpg");
const GATHR_LOGO = require("@/assets/images/gathr_logo_tight.png");

export default function Login() {
  const params = useLocalSearchParams<{ step?: string; partner?: string; mode?: Role }>();
  const [role, setRole] = useState<Role>(
    params.partner === "1" ? "seller" : params.mode && COPY[params.mode] ? params.mode : "seller"
  );
  const [step, setStep] = useState<"phone" | "otp" | "profile">(
    params.step === "profile" ? "profile" : "phone"
  );
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
      const r = await api<{ dev_code?: string }>("/auth/otp/request", {
        method: "POST",
        body: { phone: full, role },
        auth: false,
      });
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
      const r = await api<{
        access_token: string;
        refresh_token: string;
        user: User;
        is_new: boolean;
      }>("/auth/otp/verify", {
        method: "POST",
        body: { phone: full, code, role },
        auth: false,
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
      const u = await api<User>("/profile", {
        method: "PUT",
        body: { name: name.trim(), referral_code: ref.trim() || null },
      });
      setUser(u);
      toast(`Welcome to Gathr, ${u.name.split(" ")[0]}!`);
      router.replace("/(tabs)");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.root}>
      {/* Background image covering whole screen */}
      <Image
        source={LOGIN_BG}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        priority="high"
      />

      <KeyboardAwareScrollView
        bottomOffset={96}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          s.scrollContent,
          {
            paddingTop: insets.top + 16,
            paddingBottom: Math.max(insets.bottom, 24) + spacing.lg,
          },
        ]}
      >
        {/* Top Header Row with App Logo + Gathr Wordmark */}
        <View style={s.topBrandRow}>
          <Image
            source={GATHR_LOGO}
            style={s.appLogoImage}
            contentFit="contain"
          />
          <Text style={s.brandWordmark}>Gathr</Text>
        </View>

        {/* Lower Main Section shifted down */}
        <View style={s.lowerContentWrapper}>
          {/* Hero Headline with Hand-drawn Wave Underline */}
          <View style={s.headlineSection}>
            <Text style={s.headlineBlack}>Order together.</Text>
            <Text style={s.headlinePink}>Save together.</Text>
            <View style={s.waveUnderlineWrap}>
              <Svg width={96} height={10} viewBox="0 0 96 10" fill="none">
                <Path
                  d="M2 7C22 2 46 10 94 4"
                  stroke="#E11D48"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </Svg>
            </View>
          </View>

          {/* Form Container */}
          <View style={s.formContainer}>
            {step === "phone" && (
              <>
                {/* Role Badge (e.g. Partner, Customer, Rider) */}
                <View style={s.badgePill}>
                  <Ionicons name={COPY[role].badgeIcon} size={13} color="#E11D48" />
                  <Text style={s.badgePillText}>{COPY[role].badgeLabel}</Text>
                </View>

                {/* Title & Subtitle */}
                <Text testID="login-title" style={s.mainTitle}>
                  {COPY[role].title}
                </Text>
                <Text style={s.mainSub}>{COPY[role].sub}</Text>

                {/* Rounded Mobile Number Input Field with White Glassmorphism */}
                <View style={s.phoneInputContainer}>
                  <BlurView
                    intensity={28}
                    tint="light"
                    style={StyleSheet.absoluteFill}
                  />
                  <LinearGradient
                    colors={["rgba(255, 255, 255, 0.88)", "rgba(255, 255, 255, 0.65)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  {/* Subtle top glass highlight specular rim */}
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 12,
                      right: 12,
                      height: 1,
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                    }}
                  />
                  <View style={s.countryCodeBox}>
                    <Text style={s.countryCodeText}>+91</Text>
                  </View>
                  <View style={s.inputVerticalDivider} />
                  <TextInput
                    testID="login-phone-input"
                    style={s.mobileTextInput}
                    keyboardType="number-pad"
                    maxLength={10}
                    placeholder="Mobile number"
                    placeholderTextColor="#9CA3AF"
                    value={phone}
                    onChangeText={(t) => {
                      setPhone(t.replace(/\D/g, ""));
                      if (err) setErr(null);
                    }}
                    onSubmitEditing={requestOtp}
                  />
                </View>

                {/* Error message */}
                {err ? (
                  <Text testID="login-error" style={s.errorText}>
                    {err}
                  </Text>
                ) : null}

                {/* Gradient Crimson Pill Continue Button */}
                <Pressable
                  testID="login-send-otp-button"
                  onPress={requestOtp}
                  disabled={busy}
                  style={({ pressed }) => [
                    s.primaryContinueButton,
                    pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] },
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Text style={s.primaryContinueButtonText}>Continue</Text>
                      <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                    </>
                  )}
                </Pressable>

                {/* "or login as" Separator */}
                <View style={s.dividerRow}>
                  <View style={s.dividerLine} />
                  <Text style={s.dividerText}>or login as</Text>
                  <View style={s.dividerLine} />
                </View>

                {/* Simplified Role Login Buttons */}
                <View style={s.alternateRolesList}>
                  {(Object.keys(COPY) as Role[])
                    .filter((k) => k !== role && k !== "admin")
                    .map((k) => (
                      <Pressable
                        key={k}
                        testID={`login-mode-${k}`}
                        onPress={() => {
                          setRole(k);
                          setErr(null);
                        }}
                        style={({ pressed }) => [
                          s.roleOptionButton,
                          pressed && { opacity: 0.75, transform: [{ scale: 0.985 }] },
                        ]}
                      >
                        <Ionicons name={COPY[k].switchIcon} size={18} color="#E11D48" />
                        <Text style={s.roleOptionText}>{COPY[k].switch}</Text>
                        <Ionicons name="arrow-forward" size={15} color="#E11D48" />
                      </Pressable>
                    ))}
                </View>
              </>
            )}

            {step === "otp" && (
              <>
                <View style={s.badgePill}>
                  <Ionicons name="shield-checkmark-outline" size={13} color="#E11D48" />
                  <Text style={s.badgePillText}>Verification</Text>
                </View>

                <Text style={s.mainTitle}>Verify OTP</Text>
                <Text style={s.mainSub}>Sent to {full}</Text>

                {devCode ? (
                  <Pressable
                    testID="login-dev-otp-banner"
                    onPress={() => setCode(devCode)}
                    style={s.devBanner}
                  >
                    <Text style={s.devBannerLabel}>DEV MODE · tap to fill</Text>
                    <Text testID="login-dev-otp-code" style={s.devBannerCode}>
                      {devCode}
                    </Text>
                  </Pressable>
                ) : null}

                <View style={s.otpCardContainer}>
                  <BlurView
                    intensity={28}
                    tint="light"
                    style={StyleSheet.absoluteFill}
                  />
                  <LinearGradient
                    colors={["rgba(255, 255, 255, 0.88)", "rgba(255, 255, 255, 0.65)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 12,
                      right: 12,
                      height: 1,
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                    }}
                  />
                  <TextInput
                    ref={otpRef}
                    testID="login-otp-input"
                    style={s.otpInput}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="------"
                    placeholderTextColor="#9CA3AF"
                    value={code}
                    onChangeText={(t) => setCode(t.replace(/\D/g, ""))}
                    onSubmitEditing={verify}
                  />
                </View>

                {err ? (
                  <Text testID="login-error" style={s.errorText}>
                    {err}
                  </Text>
                ) : null}

                <Pressable
                  testID="login-verify-otp-button"
                  onPress={verify}
                  disabled={busy}
                  style={({ pressed }) => [
                    s.primaryContinueButton,
                    pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] },
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Text style={s.primaryContinueButtonText}>Verify & continue</Text>
                      <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                    </>
                  )}
                </Pressable>

                <Pressable
                  testID="login-change-number-button"
                  onPress={() => {
                    setStep("phone");
                    setCode("");
                    setErr(null);
                  }}
                  style={s.changeNumberBtn}
                >
                  <Text style={s.changeNumberText}>← Change number</Text>
                </Pressable>
              </>
            )}

            {step === "profile" && (
              <>
                <View style={s.badgePill}>
                  <Ionicons name="sparkles-outline" size={13} color="#E11D48" />
                  <Text style={s.badgePillText}>Profile</Text>
                </View>

                <Text style={s.mainTitle}>One last step</Text>
                <Text style={s.mainSub}>Your roommates and neighbours will see this name</Text>

                <Input
                  testID="profile-name-input"
                  label="Your name"
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
                <Input
                  testID="profile-referral-input"
                  label="Referral code (optional)"
                  placeholder="GCXXXXXX"
                  value={ref}
                  onChangeText={setRef}
                  autoCapitalize="characters"
                />

                {err ? (
                  <Text testID="login-error" style={s.errorText}>
                    {err}
                  </Text>
                ) : null}

                <Pressable
                  testID="profile-save-button"
                  onPress={saveProfile}
                  disabled={busy}
                  style={({ pressed }) => [
                    s.primaryContinueButton,
                    pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] },
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Text style={s.primaryContinueButtonText}>Start ordering</Text>
                      <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                    </>
                  )}
                </Pressable>
              </>
            )}
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    justifyContent: "space-between",
  },
  topBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  appLogoImage: {
    width: 32,
    height: 44,
  },
  brandWordmark: {
    color: "#E11D48",
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginTop: 6,
  },
  lowerContentWrapper: {
    marginTop: "auto",
    paddingTop: 40,
    justifyContent: "flex-end",
  },
  headlineSection: {
    marginBottom: 40,
  },
  headlineBlack: {
    fontSize: 42,
    fontWeight: "900",
    color: "#18181B",
    letterSpacing: -0.8,
    lineHeight: 60,
  },
  headlinePink: {
    fontSize: 40,
    fontWeight: "900",
    color: "#E11D48",
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  waveUnderlineWrap: {
    marginTop: 3,
    marginLeft: 2,
  },
  formContainer: {
    width: "100%",
    paddingBottom: 60
  },
  badgePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFE4E6",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 10,
  },
  badgePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#E11D48",
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#18181B",
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  mainSub: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
    lineHeight: 18,
    marginBottom: 20,
  },
  phoneInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.9)",
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    paddingHorizontal: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  countryCodeBox: {
    justifyContent: "center",
    paddingRight: 14,
    zIndex: 2,
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#18181B",
  },
  inputVerticalDivider: {
    width: 1,
    height: 22,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    marginRight: 14,
    zIndex: 2,
  },
  mobileTextInput: {
    flex: 1,
    height: "100%",
    fontSize: 16,
    fontWeight: "500",
    color: "#18181B",
    zIndex: 2,
  },
  errorText: {
    color: "#E11D48",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
    marginLeft: 4,
  },
  primaryContinueButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: "#E11D48",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    shadowColor: "#E11D48",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryContinueButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 22,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(0, 0, 0, 0.08)",
  },
  dividerText: {
    marginHorizontal: 14,
    fontSize: 13,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  alternateRolesList: {
    flexDirection: "row",
    gap: 12,
  },
  roleOptionButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(225, 29, 72, 0.3)",
    backgroundColor: "rgba(255, 228, 230, 0.45)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  roleOptionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#E11D48",
  },
  otpCardContainer: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.9)",
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    justifyContent: "center",
  },
  otpInput: {
    height: "100%",
    textAlign: "center",
    letterSpacing: 16,
    fontSize: 22,
    fontWeight: "800",
    color: "#18181B",
    zIndex: 2,
  },
  devBanner: {
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  devBannerLabel: {
    color: "#92400E",
    fontWeight: "700",
    fontSize: 12,
  },
  devBannerCode: {
    color: "#92400E",
    fontWeight: "900",
    fontSize: 18,
    letterSpacing: 4,
  },
  changeNumberBtn: {
    alignItems: "center",
    paddingVertical: 14,
  },
  changeNumberText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "600",
  },
}));
