import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { Bill, Line, Seller } from "./types";

export type CartStoreGroup = {
  seller: Seller;
  items: Line[];
  unavailable: Line[];
  bill: Bill | null;
  subtotal: number;
  rider_assigned_separately: boolean;
};

export type CouponItem = {
  code: string;
  type: "flat" | "percent";
  flat?: number;
  percent?: number;
  min_order: number;
  max_discount?: number;
  description: string;
  active: boolean;
};

export type CartQuoteResponse = {
  seller: Seller | null;
  items: Line[];
  unavailable: Line[];
  bill: (Bill & {
    item_discount?: number;
    total_savings?: number;
  }) | null;
  groups?: CartStoreGroup[];
  sellers?: Seller[];
  available_coupons?: CouponItem[];
  total_items?: number;
  total_price?: number;
  is_multi_store?: boolean;
};

export function useCartSummary() {
  const query = useQuery({
    queryKey: ["cart"],
    queryFn: () => api<CartQuoteResponse>("/cart/quote", { method: "POST", body: {} }),
  });

  const items = query.data?.items ?? [];
  const totalCount = query.data?.total_items ?? items.reduce((sum, item) => sum + (item.qty || 0), 0);
  const seller = query.data?.seller ?? null;
  const groups = query.data?.groups ?? [];
  const sellers = query.data?.sellers ?? (seller ? [seller] : []);
  const grandTotal = query.data?.bill?.total ?? query.data?.total_price ?? 0;
  const isMultiStore = (query.data?.is_multi_store ?? groups.length > 1) || sellers.length > 1;

  return {
    ...query,
    items,
    totalCount,
    seller,
    sellers,
    groups,
    isMultiStore,
    grandTotal,
    hasItems: totalCount > 0,
  };
}
