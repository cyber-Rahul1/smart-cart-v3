import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { queryClient } from "./query-client";
import { Bill, Line, Product, Seller } from "./types";

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

/**
 * Optimistically mutates cart item quantities in React Query cache across all keys:
 * ["cart"], ["cart", applied, useCredit], ["cart", null, false].
 * Returns rollback function in case the server rejects the request.
 */
export function applyOptimisticCartItem(
  product: Product,
  newQty: number,
  seller?: Seller
): () => void {
  const previousQueries = queryClient.getQueriesData<CartQuoteResponse>({ queryKey: ["cart"] });

  queryClient.setQueriesData<CartQuoteResponse>({ queryKey: ["cart"] }, (old) => {
    if (!old) {
      if (newQty <= 0) return old;
      const initialItem: Line = {
        id: `opt-${product.id}`,
        product_id: product.id,
        seller_id: product.seller_id,
        name: product.name,
        price: product.price,
        veg: product.veg,
        qty: newQty,
        line_total: product.price * newQty,
      };
      return {
        seller: seller ?? null,
        items: [initialItem],
        unavailable: [],
        bill: {
          subtotal: product.price * newQty,
          discount: 0,
          item_discount: 0,
          total_savings: 0,
          coupon: null,
          delivery_fee: 0,
          delivery_cost: 0,
          delivery_funding: "free",
          credit_used: 0,
          convenience_fee: 5,
          total: product.price * newQty + 5,
          multi_store: false,
        },
        groups: seller
          ? [
              {
                seller,
                items: [initialItem],
                unavailable: [],
                bill: null,
                subtotal: product.price * newQty,
                rider_assigned_separately: false,
              },
            ]
          : [],
        sellers: seller ? [seller] : [],
        total_items: newQty,
        total_price: product.price * newQty + 5,
        is_multi_store: false,
      };
    }

    const currentItems = [...(old.items ?? [])];
    const existingIndex = currentItems.findIndex((i) => i.product_id === product.id);

    if (newQty <= 0) {
      if (existingIndex !== -1) {
        currentItems.splice(existingIndex, 1);
      }
    } else {
      if (existingIndex !== -1) {
        currentItems[existingIndex] = {
          ...currentItems[existingIndex],
          qty: newQty,
          line_total: currentItems[existingIndex].price * newQty,
        };
      } else {
        currentItems.push({
          id: `opt-${product.id}`,
          product_id: product.id,
          seller_id: product.seller_id,
          name: product.name,
          price: product.price,
          veg: product.veg,
          qty: newQty,
          line_total: product.price * newQty,
        });
      }
    }

    const newTotalItems = currentItems.reduce((acc, i) => acc + (i.qty || 0), 0);
    const newSubtotal = currentItems.reduce((acc, i) => acc + (i.price || 0) * (i.qty || 0), 0);

    return {
      ...old,
      items: currentItems,
      total_items: newTotalItems,
      total_price: newSubtotal > 0 ? newSubtotal + (old.bill?.delivery_fee ?? 0) + (old.bill?.convenience_fee ?? 5) : 0,
      bill: old.bill
        ? {
            ...old.bill,
            subtotal: newSubtotal,
            total: newSubtotal > 0 ? newSubtotal + (old.bill.delivery_fee || 0) + (old.bill.convenience_fee || 5) : 0,
          }
        : null,
    };
  });

  return () => {
    previousQueries.forEach(([queryKey, data]) => {
      queryClient.setQueryData(queryKey, data);
    });
  };
}

export function useCartSummary() {
  const query = useQuery({
    queryKey: ["cart"],
    queryFn: () => api<CartQuoteResponse>("/cart/quote", { method: "POST", body: {} }),
    staleTime: 5000,
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
