import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, ScrollView, Share, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { DELIVERY_AFTER, SellerPicker, TimePicker } from "@/src/components/pickers";
import { timeLeft } from "@/src/format";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { Button, ErrorState, Header, Input, Ionicons, Loader, Sheet, useToast } from "@/src/ui";

type CD = { id: string; name: string; address: string; invite_code: string; my_flat: string; is_admin: boolean; resident_count: number; flats: string[];
  baskets: { id: string; title: string; seller_name: string; status: string; closes_at: string; flat_count: number }[] };
const COVER = "https://images.unsplash.com/photo-1515263487990-61b07816b324?w=900&q=70";

export default function CommunityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["community", id], queryFn: () => api<CD>(`/communities/${id}`) });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Weekly groceries");
  const [seller, setSeller] = useState<string>();
  const [closes, setCloses] = useState<number | null>(60);
  const [after, setAfter] = useState<number | null>(45);
  const [busy, setBusy] = useState(false);

  if (q.isLoading) return <Loader />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  const c = q.data!;

  const create = async () => {
    if (!seller) return toast("Pick a shop for the basket", "err");
    setBusy(true);
    try {
      const b = await api<{ id: string }>(`/communities/${id}/baskets`, { method: "POST", body: { seller_id: seller, title, closes_in_min: closes,
        deliver_in_min: after ? (closes ?? 0) + after : null } });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["community", id] });
      router.push(`/basket/${b.id}`);
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={c.name} subtitle={`You · Flat ${c.my_flat}`} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <View style={{ height: 150 }}>
          <Image source={{ uri: COVER }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.7)"]} style={{ flex: 1, justifyContent: "flex-end", padding: spacing.lg }}>
            <Text style={{ color: colors.onSurfaceInverse, fontWeight: "800", fontSize: font.lg }}>{c.address}</Text>
            <Text style={{ color: colors.onSurfaceInverse, opacity: 0.9 }}>{c.flats.length} flats · {c.resident_count} residents joined</Text>
          </LinearGradient>
        </View>
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          <Pressable testID="community-share-code" onPress={() => Share.share({ message: `Join ${c.name} on GathrCart with code ${c.invite_code}` })}
            style={{ flexDirection: "row", alignItems: "center", padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.pastelSky }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.onPastelSky, fontWeight: "600", fontSize: font.sm + 1 }}>Resident invite code</Text>
              <Text testID="community-invite-code" style={{ color: colors.onPastelSky, fontWeight: "900", fontSize: font.xxl, letterSpacing: 2 }}>{c.invite_code}</Text>
            </View>
            <Ionicons name="share-social" size={22} color={colors.onPastelSky} />
          </Pressable>

          <Text style={{ fontWeight: "800", fontSize: font.lg, color: colors.onSurface }}>Community baskets</Text>
          {!c.baskets.length ? <Text style={{ color: colors.muted }}>No baskets yet. Start one — neighbours add their flat's items before it closes.</Text> : null}
          {c.baskets.map((b) => (
            <Pressable key={b.id} testID={`basket-card-${b.id}`} onPress={() => router.push(`/basket/${b.id}`)}
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}>
              <Ionicons name="basket" size={24} color={colors.onPastelMint} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "800", color: colors.onSurface }}>{b.title}</Text>
                <Text style={{ color: colors.muted, fontSize: font.sm }}>{b.seller_name} · {b.flat_count} flat{b.flat_count === 1 ? "" : "s"} · {b.status === "open" ? timeLeft(b.closes_at) : b.status}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <View style={{ position: "absolute", left: spacing.lg, right: spacing.lg, bottom: insets.bottom + spacing.lg }}>
        <Button testID="community-start-basket-button" icon="add" title="Start community basket" onPress={() => setOpen(true)} />
      </View>
      <Sheet visible={open} onClose={() => setOpen(false)} title="New community basket" testID="basket-form-sheet">
        <Input testID="basket-title-input" label="Basket name" value={title} onChangeText={setTitle} />
        <Text style={{ fontWeight: "700", color: colors.onSurfaceSecondary }}>Shop (one shop per basket)</Text>
        <SellerPicker value={seller} onChange={(x) => setSeller(x.id)} />
        <Text style={{ fontWeight: "700", color: colors.onSurfaceSecondary }}>Basket closes in</Text>
        <TimePicker testPrefix="basket-closes" value={closes} onChange={setCloses} />
        <Text style={{ fontWeight: "700", color: colors.onSurfaceSecondary }}>Deliver</Text>
        <TimePicker testPrefix="basket-deliver" value={after} onChange={setAfter} options={DELIVERY_AFTER} />
        <Button testID="basket-create-submit" title="Open basket" loading={busy} onPress={create} />
      </Sheet>
    </View>
  );
}
