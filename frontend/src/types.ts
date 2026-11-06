export type Seller = {
  id: string; name: string; category: "food" | "grocery"; business_type: string; cuisine: string; image: string; rating: number;
  distance_km: number; eta_min: number; prep_time_min: number; is_new: boolean; offer?: string | null; min_order: number;
  fssai_status: string; address: string; opened_on: string; trend_score?: number;
};
export type Product = {
  id: string; seller_id: string; name: string; price: number; category: string; veg: boolean; image: string; available: boolean;
  stock: number; description: string; seller_name?: string;
};
export type Bill = {
  subtotal: number; discount: number; coupon?: string | null; delivery_fee: number; delivery_cost: number; delivery_funding: string;
  credit_used: number; convenience_fee: number; total: number; error?: string;
};
export type Line = { product_id: string; qty: number; name: string; price: number; image?: string; veg?: boolean; line_total: number; id?: string; user_id?: string; user_name?: string };
export type Address = { id: string; label: string; line: string; landmark: string; is_default: boolean };
export type Order = {
  id: string; order_no: string; user_id: string; seller_id: string; seller_name: string; seller_image: string; kind: "individual" | "group" | "community_flat";
  items: Line[]; bill: Bill; address: Address | null; scheduled_for: string | null; status: string; payment_status: string; delivery_otp?: string;
  rider: { name: string; phone: string; vehicle: string } | null; history: { status: string; at: string }[]; created_at: string; is_payer: boolean;
  group_name?: string; cart_name?: string; shares?: { user_id: string; name: string; amount: number }[]; flat?: string; community_name?: string;
  package_id?: string; package_label?: { community: string; flat: string; package_id: string; items: string[]; handling: string };
};
