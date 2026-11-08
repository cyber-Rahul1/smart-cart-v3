import { RoleTabs, TabDef } from "@/src/components/role-nav";

const TABS: TabDef[] = [
  { name: "index", title: "Overview", icon: "stats-chart-outline", active: "stats-chart", sf: "chart.bar.fill" },
  { name: "shops", title: "Shops", icon: "storefront-outline", active: "storefront", sf: "storefront.fill" },
  { name: "riders", title: "Riders", icon: "bicycle-outline", active: "bicycle", sf: "bicycle" },
  { name: "fees", title: "Fees", icon: "cash-outline", active: "cash", sf: "indianrupeesign.circle.fill" },
];

export default function AdminTabs() {
  return <RoleTabs tabs={TABS} testPrefix="admin" />;
}
