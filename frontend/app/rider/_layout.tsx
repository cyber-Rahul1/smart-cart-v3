import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useEffect, useRef } from "react";

import { api } from "@/src/api";
import { RoleStack } from "@/src/components/role-nav";
import { RiderJob } from "@/src/rider";

/** While the rider carries packages and has allowed location, stream foreground GPS to the server every ~8 s. */
function LocationSharer() {
  const active = useQuery({ queryKey: ["rider-active"], queryFn: () => api<RiderJob[]>("/rider/active"), refetchInterval: 10000 });
  const perm = useQuery({ queryKey: ["loc-perm"], queryFn: () => Location.getForegroundPermissionsAsync(), refetchInterval: 10000 });
  const on = !!active.data?.length && !!perm.data?.granted;
  const last = useRef(0);
  useEffect(() => {
    if (!on) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 }, (p) => {
      if (Date.now() - last.current < 8000) return;
      last.current = Date.now();
      api("/rider/location", { method: "PUT", body: { lat: p.coords.latitude, lng: p.coords.longitude, heading: p.coords.heading ?? null } }).catch(() => {});
    }).then((s) => { if (cancelled) s.remove(); else sub = s; }).catch(() => {});
    return () => { cancelled = true; sub?.remove(); };
  }, [on]);
  return null;
}

export default function RiderLayout() {
  return (
    <>
      <LocationSharer />
      <RoleStack role="rider" loginMode="rider" />
    </>
  );
}
