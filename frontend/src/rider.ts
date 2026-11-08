export type RiderJob = {
  id: string; order_no: string; kind: string; status: string; flat?: string; community_name?: string; package_id?: string;
  package_label?: { community: string; flat: string; package_id: string; items: string[]; handling: string };
  items: { name: string; qty: number }[]; weight: number; item_count: number; fee: number; scheduled_for: string | null; ref_id?: string;
  collect_cash: number; pickup_point: { lat: number; lng: number } | null; drop_point: { lat: number; lng: number } | null;
  pickup: { name: string; address: string }; drop: { name: string; address: string; landmark: string }; delivered_at?: string;
};
export type Rider = {
  id: string; name: string; phone: string; vehicle: string; vehicle_number: string; licence_number: string; max_packages: number; max_weight_kg: number; max_items?: number;
  available: boolean; verified: boolean; approval_status: string; review_note?: string; load?: { packages: number; weight: number; items?: number };
};
export type RiderRun = { run_no: number; packages: { order_id: string; flat: string; package_id: string; weight: number; items: number }[]; weight: number; items: number; fee: number; oversize: boolean };
