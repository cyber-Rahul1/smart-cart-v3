import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";

import { api } from "@/src/api";
import { RoleTabs, TabDef } from "@/src/components/role-nav";
import { ErrorState, Loader } from "@/src/ui";

const TABS: TabDef[] = [
  { name: "index", title: "Jobs", icon: "flash-outline", active: "flash", sf: "bolt.fill" },
  { name: "active", title: "Deliveries", icon: "bicycle-outline", active: "bicycle", sf: "bicycle" },
  { name: "profile", title: "Profile", icon: "person-circle-outline", active: "person-circle", sf: "person.crop.circle.fill" },
];

export default function RiderTabs() {
  const q = useQuery({ queryKey: ["rider-me"], queryFn: () => api<{ rider: any }>("/rider/me") });
  if (q.isLoading) return <Loader />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  if (!q.data?.rider) return <Redirect href="/rider/onboarding" />;
  return <RoleTabs tabs={TABS} testPrefix="rider" />;
}
