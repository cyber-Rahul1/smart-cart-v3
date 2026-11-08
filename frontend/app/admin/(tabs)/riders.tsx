import { Text } from "react-native";

import { ReviewList } from "@/src/components/review-list";
import { Rider } from "@/src/rider";
import { font, useTheme } from "@/src/theme";

export default function AdminRiders() {
  const { colors } = useTheme();
  return (
    <ReviewList<Rider & { review_note?: string }> kind="riders" title="Rider verification" render={(r) => (
      <>
        <Text style={{ fontWeight: "800", color: colors.onSurface, fontSize: font.base + 1 }}>{r.name}</Text>
        <Text style={{ color: colors.muted, fontSize: font.sm }}>{r.phone} · {r.vehicle} {r.vehicle_number}</Text>
        <Text testID={`admin-rider-licence-${r.id}`} style={{ color: colors.onSurfaceSecondary, fontSize: font.sm, fontWeight: "700" }}>Licence: {r.licence_number || "—"}</Text>
        <Text style={{ color: colors.muted, fontSize: font.sm }}>Capacity {r.max_packages} pkgs / {r.max_weight_kg} kg</Text>
        {r.review_note ? <Text style={{ color: colors.error, fontSize: font.sm }}>Note: {r.review_note}</Text> : null}
      </>
    )} />
  );
}
