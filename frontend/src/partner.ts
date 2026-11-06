export type SellerOrder = {
  id: string; order_no: string; kind: "individual" | "group" | "community_flat"; status: string; scheduled_for: string | null; created_at: string;
  items: { product_id: string; name: string; qty: number; price: number; line_total: number; user_name?: string; veg?: boolean }[];
  flat?: string; community_name?: string; package_id?: string; group_name?: string; cart_name?: string; notes?: string; ref_id?: string;
  package_label?: { community: string; flat: string; package_id: string; items: string[]; handling: string };
  subtotal: number; commission: number; payout: number; area: string; packed: boolean[]; all_packed: boolean;
  history: { status: string; at: string }[];
};
export type Shop = {
  id: string; name: string; owner_name: string; category: "food" | "grocery"; business_type: string; cuisine: string; image: string;
  approved: boolean; approval_status: string; open: boolean; prep_time_min: number; min_order: number; offer: string | null;
  fssai_status: string; fssai_number?: string; address: string; opens_at: string; closes_at: string;
};
export type Batch = { basket_id: string; community_name: string; scheduled_for: string | null; packages: SellerOrder[]; ready_count: number; items_total: { name: string; qty: number }[] };

export const KIND_LABEL = (o: SellerOrder) =>
  o.kind === "community_flat" ? `Flat ${o.flat} · ${o.community_name}` : o.kind === "group" ? `Group · ${o.group_name}` : "Individual";
