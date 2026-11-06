import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Share, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { DELIVERY_AFTER, PERM_LABELS, SellerPicker, TimePicker } from "@/src/components/pickers";
import { timeLeft } from "@/src/format";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, ErrorState, Header, Input, Ionicons, Loader, Sheet, useToast } from "@/src/ui";

type GroupD = { id: string; name: string; invite_code: string; owner_id: string; members: { user_id: string; name: string; phone: string }[];
  carts: { id: string; name: string; seller_name: string; status: string; closes_at: string; item_count: number }[] };

const DEFAULT_PERMS: Record<string, boolean> = { view_cart: true, add_items: true, modify_own: true, modify_others: false, remove_own: true, remove_others: false, close_cart: false, finalize: false };

export default function GroupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["group", id], queryFn: () => api<GroupD>(`/groups/${id}`) });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Dinner Tonight");
  const [seller, setSeller] = useState<string | undefined>();
  const [closes, setCloses] = useState<number | null>(30);
  const [deliverAfter, setDeliverAfter] = useState<number | null>(null);
  const [perms, setPerms] = useState(DEFAULT_PERMS);
  const [busy, setBusy] = useState(false);

  if (q.isLoading) return <Loader />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  const g = q.data!;

  const create = async () => {
    if (!seller) return toast("Pick a shop for this cart", "err");
    setBusy(true);
    try {
      const c = await api<{ id: string }>(`/groups/${id}/carts`, { method: "POST", body: {
        name, seller_id: seller, closes_in_min: closes, deliver_in_min: deliverAfter ? (closes ?? 0) + deliverAfter : null, permissions: perms } });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["group", id] });
      router.push(`/group-cart/${c.id}`);
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.root}>
      <Header title={g.name} subtitle={`${g.members.length} members`} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + 100 }}>
        <Pressable testID="group-share-code" onPress={() => Share.share({ message: `Join my GathrCart group "${g.name}" with code ${g.invite_code}` })} style={s.code}>
          <View style={{ flex: 1 }}>
            <Text style={s.codeLabel}>Invite roommates with code</Text>
            <Text testID="group-invite-code" style={s.codeVal}>{g.invite_code}</Text>
          </View>
          <Ionicons name="share-social" size={22} color={colors.onPastelLilac} />
        </Pressable>

        <View>
          <Text style={s.h}>Members</Text>
          {g.members.map((m) => (
            <View key={m.user_id} style={s.member} testID={`group-member-${m.user_id}`}>
              <View style={s.av}><Text style={s.avText}>{m.name.slice(0, 1).toUpperCase()}</Text></View>
              <Text style={{ flex: 1, fontWeight: "700", color: colors.onSurface }}>{m.name}{m.user_id === user?.id ? " (you)" : ""}</Text>
              {m.user_id === g.owner_id ? <Text style={s.owner}>Owner</Text> : g.owner_id === user?.id ? (
                <Pressable testID={`group-remove-member-${m.user_id}`} onPress={async () => { await api(`/groups/${id}/members/${m.user_id}`, { method: "DELETE" }); q.refetch(); }}>
                  <Text style={{ color: colors.error, fontWeight: "700" }}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>

        <View>
          <Text style={s.h}>Shared carts</Text>
          {!g.carts.length ? <Text style={{ color: colors.muted }}>No carts yet. Start one and everyone can add their items.</Text> : null}
          {g.carts.map((c) => (
            <Pressable key={c.id} testID={`group-cart-card-${c.id}`} onPress={() => router.push(`/group-cart/${c.id}`)} style={s.cart}>
              <Ionicons name="cart" size={22} color={colors.brandPrimary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "800", color: colors.onSurface }}>{c.name}</Text>
                <Text style={{ color: colors.muted, fontSize: font.sm }}>{c.seller_name} · {c.item_count} item{c.item_count === 1 ? "" : "s"} · {c.status === "open" ? timeLeft(c.closes_at) : c.status}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <View style={{ position: "absolute", left: spacing.lg, right: spacing.lg, bottom: insets.bottom + spacing.lg }}>
        <Button testID="group-start-cart-button" icon="add" title="Start a shared cart" onPress={() => setOpen(true)} />
      </View>

      <Sheet visible={open} onClose={() => setOpen(false)} title="New shared cart" testID="group-cart-form-sheet">
        <Input testID="group-cart-name-input" label="Cart name" value={name} onChangeText={setName} />
        <Text style={s.label}>Shop</Text>
        <SellerPicker value={seller} onChange={(x) => setSeller(x.id)} />
        <Text style={s.label}>Cart closes in</Text>
        <TimePicker testPrefix="group-cart-closes" value={closes} onChange={setCloses} />
        <Text style={s.label}>Deliver</Text>
        <TimePicker testPrefix="group-cart-deliver" value={deliverAfter} onChange={setDeliverAfter} options={DELIVERY_AFTER} />
        <Text style={s.label}>What members can do</Text>
        {PERM_LABELS.map(([k, l]) => (
          <View key={k} style={{ flexDirection: "row", alignItems: "center", minHeight: 40 }}>
            <Text style={{ flex: 1, color: colors.onSurface }}>{l}</Text>
            <Switch testID={`perm-switch-${k}`} value={perms[k]} onValueChange={(v) => setPerms((p) => ({ ...p, [k]: v }))} trackColor={{ true: colors.brandSecondary, false: colors.borderStrong }} thumbColor={colors.surface} />
          </View>
        ))}
        <Button testID="group-cart-create-submit" title="Open shared cart" loading={busy} onPress={create} />
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  code: { flexDirection: "row", alignItems: "center", padding: spacing.lg, borderRadius: radius.md, backgroundColor: c.pastelLilac },
  codeLabel: { color: c.onPastelLilac, fontWeight: "600", fontSize: font.sm + 1 },
  codeVal: { color: c.onPastelLilac, fontWeight: "900", fontSize: font.xxl, letterSpacing: 3 },
  h: { fontWeight: "800", fontSize: font.lg, color: c.onSurface, marginBottom: spacing.sm },
  member: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  av: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  avText: { fontWeight: "900", color: c.brandPrimary },
  owner: { color: c.onPastelLilac, backgroundColor: c.pastelLilac, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm, fontWeight: "700", fontSize: font.sm, overflow: "hidden" },
  cart: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, marginTop: spacing.sm },
  label: { fontWeight: "700", color: c.onSurfaceSecondary, fontSize: font.sm + 1 },
}));
