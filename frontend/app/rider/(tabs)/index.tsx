import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { PartnerHeader } from "@/src/components/partner-header";
import { rupee } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { Rider, RiderJob, RiderRun } from "@/src/rider";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, EmptyState, Ionicons, Loader, useToast } from "@/src/ui";

type Jobs = { singles: RiderJob[]; batches: { basket_id: string; community_name: string; pickup: { name: string; address: string }; packages: RiderJob[]; runs: RiderRun[]; total_weight: number; total_items: number; bag_full: boolean }[] };

export default function RiderJobs() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const me = useQuery({ queryKey: ["rider-me"], queryFn: () => api<{ rider: Rider }>("/rider/me") });
  const jobs = useQuery({ queryKey: ["rider-jobs"], queryFn: () => api<Jobs>("/rider/jobs"), refetchInterval: 10000 });
  const r = me.data?.rider;
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const refresh = () => { me.refetch(); jobs.refetch(); };
  const toggle = async (v: boolean) => {
    try { await api("/rider/availability", { method: "PUT", body: { available: v } }); refresh(); } catch (e: any) { toast(e.message, "err"); }
  };
  const claim = async (key: string, ids: string[]) => {
    setBusy(key);
    try {
      const res = await api<{ claimed: string[]; skipped: string[] }>("/rider/claim", { method: "POST", body: { order_ids: ids } });
      toast(res.skipped.length ? `Took ${res.claimed.length} package(s); ${res.skipped.length} left for another rider (capacity)` : `Accepted ${res.claimed.length} package(s)`);
      qc.invalidateQueries({ queryKey: ["rider-active"] });
      refresh();
      router.push("/rider/active");
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(null);
    }
  };

  if (me.isLoading || !r) return <Loader />;
  return (
    <View style={s.root}>
      <PartnerHeader title={r.name} subtitle={`${r.vehicle} · capacity ${r.max_packages} pkgs / ${r.max_weight_kg} kg / ${r.max_items ?? 25} items · load ${r.load?.packages ?? 0} pkgs`}
        right={<Switch testID="rider-online-switch" value={r.available} onValueChange={toggle} disabled={!r.verified} trackColor={{ true: colors.success, false: colors.borderStrong }} thumbColor={colors.surface} />} />
      {!r.verified ? (
        <View testID="rider-pending-banner" style={s.pending}>
          <Ionicons name="hourglass-outline" size={18} color={colors.onPastelLemon} />
          <Text style={{ flex: 1, color: colors.onPastelLemon, fontWeight: "600" }}>
            {r.approval_status === "rejected" ? `Not approved: ${r.review_note ?? ""}` : "Your documents are under review by GathrCart admins. You can go online once verified."}</Text>
        </View>
      ) : !r.available ? (
        <View style={s.pending}><Text style={{ color: colors.onPastelLemon, fontWeight: "600" }}>You are offline. Switch on (top right) to accept jobs.</Text></View>
      ) : null}
      <ScrollView refreshControl={<RefreshControl refreshing={jobs.isRefetching} onRefresh={refresh} tintColor={colors.brandPrimary} />}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: bottomChrome + spacing.xl }}>
        {jobs.isLoading ? <Loader /> : !jobs.data?.singles.length && !jobs.data?.batches.length ? (
          <EmptyState testID="rider-jobs-empty" icon="bicycle-outline" title="No packages waiting" body="Packed orders ready for pickup near you appear here. Pull to refresh." />
        ) : null}
        {jobs.data?.batches.map((b) => (
            <View key={b.basket_id} testID={`rider-batch-${b.basket_id}`} style={[s.card, { borderColor: colors.onPastelSky }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Ionicons name="business" size={20} color={colors.onPastelSky} />
                <Text style={[s.title, { flex: 1 }]}>{b.community_name} · {b.packages.length} flat{b.packages.length > 1 ? "s" : ""}</Text>
                <Text style={s.fee}>{rupee(b.packages.reduce((a, p) => a + p.fee, 0))}</Text>
              </View>
              <Text style={s.sub}>Pickup: {b.pickup.name} · {b.pickup.address}</Text>
              <Text style={s.sub}>Total {b.total_items} items · {b.total_weight} kg · split into {b.runs.length} run{b.runs.length > 1 ? "s" : ""} that fit your bag</Text>
              {b.runs.map((run) => (
                <View key={run.run_no} testID={`rider-run-${b.basket_id}-${run.run_no}`} style={s.run}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontWeight: "800", color: colors.onSurface }}>Run {run.run_no} · {run.packages.length} flat{run.packages.length > 1 ? "s" : ""} · {rupee(run.fee)}</Text>
                    <Text style={s.sub}>{run.packages.map((p) => `Flat ${p.flat}`).join(", ")}</Text>
                    <Text style={s.sub}>{run.items} items · {run.weight} kg{run.oversize ? " · oversize package" : ""}</Text>
                  </View>
                  <Button testID={`rider-claim-run-${b.basket_id}-${run.run_no}`} small title="Accept" loading={busy === `${b.basket_id}-${run.run_no}`} disabled={!r.available || b.bag_full}
                    onPress={() => claim(`${b.basket_id}-${run.run_no}`, run.packages.map((p) => p.order_id))} />
                </View>
              ))}
              {b.runs.length > 1 ? (
                <Button testID={`rider-claim-batch-${b.basket_id}`} small variant="secondary" title="Take as many as fit" loading={busy === b.basket_id} disabled={!r.available}
                  onPress={() => claim(b.basket_id, b.packages.map((p) => p.id))} />
              ) : null}
            </View>
        ))}
        {jobs.data?.singles.map((j) => (
          <View key={j.id} testID={`rider-job-${j.id}`} style={s.card}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Ionicons name="cube-outline" size={20} color={colors.brandPrimary} />
              <Text style={[s.title, { flex: 1 }]}>{j.order_no}</Text>
              <Text style={s.fee}>{rupee(j.fee)}</Text>
            </View>
            <Text style={s.sub}>Pickup: {j.pickup.name} · {j.pickup.address}</Text>
            <Text style={s.sub}>Drop: {j.drop.address}</Text>
            <Text style={s.sub}>{j.items.length} items · {j.weight} kg</Text>
            <Button testID={`rider-claim-${j.id}`} small title="Accept job" loading={busy === j.id} disabled={!r.available} onPress={() => claim(j.id, [j.id])} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceSecondary },
  pending: { flexDirection: "row", gap: spacing.sm, alignItems: "center", backgroundColor: c.pastelLemon, padding: spacing.md },
  card: { backgroundColor: c.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: c.border, gap: spacing.sm },
  title: { fontWeight: "800", color: c.onSurface, fontSize: font.base + 1 },
  sub: { color: c.muted, fontSize: font.sm + 1 },
  fee: { fontWeight: "900", color: c.success },
  run: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.pastelSky, borderRadius: radius.md, padding: spacing.md },
}));
