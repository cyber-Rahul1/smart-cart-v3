import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";

import { api } from "@/src/api";
import { LatLng, MapMarker, OsmMap } from "@/src/components/osm-map";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { Ionicons } from "@/src/ui";

type Track = {
  status: string; pickup: LatLng | null; drop: LatLng | null; live: boolean; distance_km: number | null; eta_min: number | null;
  rider: { name: string; vehicle: string; location: (LatLng & { at: string }) | null } | null;
};

/** Customer's live map: shop, home and the rider's latest GPS position, refreshed every 5 seconds. */
export function LiveTrack({ orderId }: { orderId: string }) {
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ["track", orderId], queryFn: () => api<Track>(`/delivery/orders/${orderId}/track`), refetchInterval: 5000 });
  const t = q.data;
  if (!t || (!t.pickup && !t.drop)) return null;
  const markers: MapMarker[] = [];
  if (t.pickup) markers.push({ id: "shop", kind: "shop", ...t.pickup });
  if (t.drop) markers.push({ id: "home", kind: "home", ...t.drop });
  const loc = t.rider?.location;
  if (loc) markers.push({ id: "rider", kind: "rider", lat: loc.lat, lng: loc.lng });
  const center = loc ?? t.drop ?? t.pickup!;
  const headline = t.live ? `Arriving in ~${t.eta_min} min` : t.rider ? `${t.rider.name} is assigned` : t.status === "out_for_delivery" ? "On the way" : "Waiting for a rider";
  const sub = t.live ? `${t.rider!.name} · ${t.rider!.vehicle} · ${t.distance_km} km away${t.status === "ready_for_pickup" ? " (heading to the shop first)" : ""}`
    : t.rider ? "Live location appears once your rider starts sharing GPS" : "We'll show your rider here as soon as one picks up your order";
  return (
    <View testID="order-live-track" style={{ borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      <View style={{ height: 220 }}>
        <OsmMap testID="order-live-map" center={center} zoom={14} markers={markers} fitMarkers route />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.live ? colors.pastelMint : colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={t.live ? "bicycle" : "time-outline"} size={20} color={t.live ? colors.onPastelMint : colors.muted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text testID="order-live-eta" style={{ fontWeight: "800", color: colors.onSurface, fontSize: font.base + 1 }}>{headline}</Text>
          <Text style={{ color: colors.muted, fontSize: font.sm }}>{sub}</Text>
        </View>
        {t.live ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }} /> : null}
      </View>
    </View>
  );
}
