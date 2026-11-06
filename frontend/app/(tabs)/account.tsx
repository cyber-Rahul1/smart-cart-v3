import { router } from "expo-router";
import { Pressable, ScrollView, Share, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { usesNativeTabs } from "@/src/navigation";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, IconName, Ionicons } from "@/src/ui";

const LINKS: { key: string; label: string; sub: string; icon: IconName; href: string }[] = [
  { key: "orders", label: "Your orders", sub: "Track, reorder, cancel", icon: "receipt-outline", href: "/orders" },
  { key: "groups", label: "Roommate groups", sub: "Shared carts with your flatmates", icon: "people-outline", href: "/groups" },
  { key: "community", label: "Apartment community", sub: "Community baskets, flat-wise bills", icon: "business-outline", href: "/community" },
  { key: "addresses", label: "Saved addresses", sub: "Home, work and more", icon: "location-outline", href: "/addresses" },
  { key: "notifications", label: "Notifications", sub: "Order & cart updates", icon: "notifications-outline", href: "/notifications" },
  { key: "referrals", label: "Refer & earn", sub: "Free deliveries for every friend", icon: "gift-outline", href: "/referrals" },
];

export default function Account() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const { user, signOut } = useAuth();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: bottomChrome + spacing.xl }}>
        <View style={s.profile}>
          <View style={s.avatar}><Text style={s.avatarText}>{(user?.name || "G").slice(0, 1).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text testID="account-name" style={s.name}>{user?.name}</Text>
            <Text testID="account-phone" style={s.phone}>{user?.phone}</Text>
          </View>
        </View>

        <Pressable testID="account-referral-card" onPress={() => Share.share({ message: `Join me on GathrCart! Use my code ${user?.referral_code} to sign up.` })} style={s.refer}>
          <Ionicons name="gift" size={28} color={colors.brandPrimary} />
          <View style={{ flex: 1 }}>
            <Text style={s.referTitle}>Your code: {user?.referral_code}</Text>
            <Text style={s.referSub}>{user?.delivery_credits ?? 0} free-delivery credits · Tap to share</Text>
          </View>
          <Ionicons name="share-social-outline" size={20} color={colors.brandPrimary} />
        </Pressable>

        <View style={s.list}>
          {LINKS.map((l, i) => (
            <Pressable key={l.key} testID={`account-link-${l.key}`} onPress={() => router.push(l.href as any)}
              style={({ pressed }) => [s.row, i > 0 && s.rowBorder, pressed && { backgroundColor: colors.surfaceSecondary }]}>
              <View style={s.rowIcon}><Ionicons name={l.icon} size={20} color={colors.onSurface} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>{l.label}</Text>
                <Text style={s.rowSub}>{l.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </View>

        <View style={s.soon} testID="account-partner-apps-soon">
          <Text style={s.soonTitle}>Seller, Rider & Admin apps</Text>
          <Text style={s.soonSub}>Not yet implemented — coming in the next milestones. Order status steps are simulated in demo mode for now.</Text>
        </View>

        <Button testID="account-logout-button" variant="danger" icon="log-out-outline" title="Log out" onPress={async () => { await signOut(); router.replace("/login"); }}
          style={{ marginHorizontal: spacing.lg, marginTop: spacing.xl }} />
        <Text style={s.version}>GathrCart · Milestone 1 · Demo payments</Text>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  profile: { flexDirection: "row", alignItems: "center", gap: spacing.lg, paddingHorizontal: spacing.lg },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: font.xxl, fontWeight: "900", color: c.brandPrimary },
  name: { fontSize: font.xxl, fontWeight: "800", color: c.onSurface },
  phone: { color: c.muted, marginTop: 2 },
  refer: { margin: spacing.lg, padding: spacing.lg, borderRadius: radius.md, backgroundColor: c.brandTertiary, flexDirection: "row", alignItems: "center", gap: spacing.md },
  referTitle: { fontWeight: "800", color: c.onSurface, fontSize: font.lg },
  referSub: { color: c.onSurfaceSecondary, fontSize: font.sm + 1, marginTop: 2 },
  list: { marginHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, minHeight: 64 },
  rowBorder: { borderTopWidth: 1, borderTopColor: c.divider },
  rowIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontWeight: "700", color: c.onSurface, fontSize: font.base + 1 },
  rowSub: { color: c.muted, fontSize: font.sm },
  soon: { margin: spacing.lg, marginBottom: 0, padding: spacing.lg, borderRadius: radius.md, backgroundColor: c.pastelLilac },
  soonTitle: { fontWeight: "800", color: c.onPastelLilac },
  soonSub: { color: c.onPastelLilac, fontSize: font.sm, marginTop: 4, lineHeight: 18 },
  version: { textAlign: "center", color: c.muted, fontSize: font.sm, marginTop: spacing.lg },
}));
