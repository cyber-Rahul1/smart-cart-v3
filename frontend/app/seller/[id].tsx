import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError } from "@/src/api";
import { useAuth } from "@/src/auth";
import { rupee, mediaUri } from "@/src/format";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Product, Seller } from "@/src/types";
import { Button, ErrorState, Ionicons, Loader, Sheet, Stepper, useToast, VegMark } from "@/src/ui";

type ModeItem = { id: string; product_id: string; qty: number; user_id: string; flat?: string };

const HERO_HEIGHT = 240;
const CARD_PEEK = 40; // amount the card overlaps the bottom of hero

export default function SellerScreen() {
  const { id, gc, bk } = useLocalSearchParams<{ id: string; gc?: string; bk?: string }>();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const [conflict, setConflict] = useState<{ product_id: string; qty: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { user } = useAuth();

  const scrollY = useSharedValue(0);

  const q = useQuery({ queryKey: ["seller", id], queryFn: () => api<{ seller: Seller; products: Product[] }>(`/sellers/${id}`) });
  const mode: "cart" | "group" | "basket" = gc ? "group" : bk ? "basket" : "cart";
  const cart = useQuery({ queryKey: ["cart", null, false], queryFn: () => api<any>("/cart/quote", { method: "POST", body: {} }), enabled: mode === "cart" });
  const group = useQuery({ queryKey: ["group-cart", gc], queryFn: () => api<any>(`/group-carts/${gc}`), enabled: mode === "group" });
  const basket = useQuery({ queryKey: ["basket", bk], queryFn: () => api<any>(`/community-baskets/${bk}`), enabled: mode === "basket" });

  const myItems: ModeItem[] = useMemo(() => {
    if (mode === "group") return (group.data?.items ?? []).filter((i: ModeItem) => i.user_id === user?.id);
    if (mode === "basket") return basket.data?.my_items ?? [];
    return cart.data?.seller?.id === id ? cart.data.items : [];
  }, [mode, group.data, basket.data, cart.data, id, user?.id]);

  const qtyOf = (pid: string) => myItems.filter((i) => i.product_id === pid).reduce((a, i) => a + i.qty, 0);
  const totalQty = myItems.reduce((a, i) => a + i.qty, 0);

  const change = async (p: Product, next: number, replace = false) => {
    setBusy(p.id);
    try {
      if (mode === "cart") {
        await api("/cart/items", { method: "POST", body: { product_id: p.id, qty: next, replace } });
        qc.invalidateQueries({ queryKey: ["cart"] });
      } else {
        const base = mode === "group" ? `/group-carts/${gc}` : `/community-baskets/${bk}`;
        const existing = myItems.find((i) => i.product_id === p.id);
        if (existing) await api(`${base}/items/${existing.id}`, { method: "PATCH", body: { qty: next } });
        else await api(`${base}/items`, { method: "POST", body: { product_id: p.id, qty: next } });
        qc.invalidateQueries({ queryKey: mode === "group" ? ["group-cart", gc] : ["basket", bk] });
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && mode === "cart") setConflict({ product_id: p.id, qty: next });
      else toast((e as Error).message, "err");
    } finally {
      setBusy(null);
    }
  };

  // Scroll distance needed for the card to travel from its initial position to the top
  const maxScroll = Math.max(1, HERO_HEIGHT - CARD_PEEK - insets.top);

  // Animated style for the floating card: translates up, scales to full width (0 margins), and flattens top border radius
  const cardAnimStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    const progress = Math.min(1, Math.max(0, y / maxScroll));

    // Stick to top once y >= maxScroll
    const translateY = y >= maxScroll ? y - maxScroll : 0;

    // Horizontal margin smoothly shrinks from spacing.lg (16) to 0 (full screen width)
    const marginHorizontal = interpolate(progress, [0, 1], [spacing.lg, 0]);

    // Border radius smoothly flattens at the top
    const borderTopLeftRadius = interpolate(progress, [0, 1], [radius.lg, 0]);
    const borderTopRightRadius = interpolate(progress, [0, 1], [radius.lg, 0]);
    const borderBottomLeftRadius = interpolate(progress, [0, 1], [radius.lg, radius.md]);
    const borderBottomRightRadius = interpolate(progress, [0, 1], [radius.lg, radius.md]);

    // Subtle elevation shadow fades out as it docks to top header
    const elevation = interpolate(progress, [0, 1], [4, 2]);

    return {
      transform: [{ translateY }],
      marginHorizontal,
      borderTopLeftRadius,
      borderTopRightRadius,
      borderBottomLeftRadius,
      borderBottomRightRadius,
      elevation,
    };
  });

  // Animated style for fixed background image: stays fixed, subtle zoom on over-pull
  const bgImageAnimStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    const scale = y < 0 ? 1 + Math.abs(y) / HERO_HEIGHT : 1;
    return {
      transform: [{ scale }],
    };
  });

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.value = e.nativeEvent.contentOffset.y;
  };

  if (q.isLoading) return <Loader />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  const { seller, products } = q.data!;
  const sections = Object.entries(products.reduce<Record<string, Product[]>>((acc, p) => ((acc[p.category] ??= []).push(p), acc), {}))
    .map(([title, data]) => ({ title, data }));
  const modeLabel = mode === "group" ? `Adding to shared cart: ${group.data?.name ?? ""}` : mode === "basket" ? `Adding to Flat ${basket.data?.my_flat ?? ""} · ${basket.data?.title ?? ""}` : null;

  return (
    <View style={s.root}>
      {/* 1. FIXED BACKGROUND HERO IMAGE */}
      <View style={s.fixedHeroContainer} pointerEvents="none">
        <Animated.View style={[StyleSheet.absoluteFill, bgImageAnimStyle]}>
          <Image
            source={{ uri: mediaUri(seller.image) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        </Animated.View>
        <View style={s.heroDarkGradient} />
      </View>

      {/* 2. FLOATING FIXED BACK BUTTON (Always accessible at top left) */}
      <View style={[s.fixedBackButtonWrapper, { top: insets.top + spacing.sm }]}>
        <Pressable
          testID="seller-back-button"
          onPress={() => router.back()}
          style={s.roundBackBtn}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
      </View>

      {/* 3. SCROLLABLE MENU & SECTIONS WITH ANIMATED FLOATING CARD */}
      <SectionList
        testID="seller-menu-list"
        sections={sections}
        keyExtractor={(p) => p.id}
        stickySectionHeadersEnabled={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        ListHeaderComponent={
          <View style={s.listHeaderWrapper}>
            {/* Transparent spacer so hero image is visible behind */}
            <View style={{ height: HERO_HEIGHT - CARD_PEEK }} />

            {/* SMOOTHLY DOCKING & FULL-WIDTH SCALING CARD */}
            <Animated.View style={[s.floatingCard, cardAnimStyle]}>
              <Text testID="seller-name" style={s.name}>{seller.name}</Text>
              <Text style={s.cuisine}>{seller.cuisine} · {seller.address}</Text>

              <View style={s.metaRow}>
                <View style={s.rating}>
                  <Ionicons name="star" size={12} color={colors.onSuccess} />
                  <Text style={s.ratingText}>{seller.rating}</Text>
                </View>
                <Text style={s.meta}>{seller.eta_min} mins · {seller.distance_km} km · Prep {seller.prep_time_min} min</Text>
              </View>

              {seller.offer ? (
                <View style={s.offer}>
                  <Ionicons name="pricetag" size={14} color={colors.brandPrimary} />
                  <Text style={s.offerText}>{seller.offer}</Text>
                </View>
              ) : null}

              {seller.fssai_status === "verified" ? (
                <Text style={s.fssai}>FSSAI verified · Min order {rupee(seller.min_order)}</Text>
              ) : (
                <Text style={s.fssai}>Min order {rupee(seller.min_order)}</Text>
              )}

              {modeLabel ? (
                <View testID="seller-mode-banner" style={s.mode}>
                  <Ionicons name={mode === "group" ? "people" : "business"} size={16} color={colors.onPastelLilac} />
                  <Text style={s.modeText}>{modeLabel}</Text>
                </View>
              ) : null}
            </Animated.View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={s.sectionHeaderBox}>
            <Text style={s.sectionTitle}>{section.title} ({section.data.length})</Text>
          </View>
        )}
        renderItem={({ item: p }) => (
          <View style={s.item} testID={`product-${p.id}`}>
            <View style={{ flex: 1, gap: 4 }}>
              <VegMark veg={p.veg} />
              <Text style={s.pname}>{p.name}</Text>
              <Text style={s.pprice}>{rupee(p.price)}</Text>
              <Text style={s.pdesc} numberOfLines={2}>
                {p.available ? (p.stock < 10 ? `Only ${p.stock} left` : p.description) : "Currently unavailable"}
              </Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Image source={{ uri: mediaUri(p.image) }} style={s.pimg} contentFit="cover" transition={150} />
              <View style={{ marginTop: -18 }}>
                <Stepper testID={`product-stepper-${p.id}`} qty={qtyOf(p.id)} disabled={!p.available || busy === p.id} onChange={(n) => change(p, n)} />
              </View>
            </View>
          </View>
        )}
      />

      {totalQty > 0 ? (
        <View style={[s.bar, { bottom: insets.bottom + spacing.lg }]}>
          <Pressable testID="seller-view-cart-bar" style={s.barInner}
            onPress={() => (mode === "cart" ? router.push("/(tabs)/cart") : mode === "group" ? router.back() : router.back())}>
            <Text style={s.barText}>{totalQty} item{totalQty > 1 ? "s" : ""} added</Text>
            <Text style={s.barText}>{mode === "cart" ? "View cart" : mode === "group" ? "Back to shared cart" : "Back to basket"}  ›</Text>
          </Pressable>
        </View>
      ) : null}

      <Sheet visible={!!conflict} onClose={() => setConflict(null)} title="Replace cart items?" testID="replace-cart-sheet">
        <Text style={{ color: colors.onSurfaceSecondary, lineHeight: 20 }}>Your cart has items from another shop. Start a fresh cart with {seller.name}?</Text>
        <Button testID="replace-cart-confirm" title="Yes, start fresh" onPress={() => { const c = conflict!; setConflict(null); change(products.find((x) => x.id === c.product_id)!, c.qty, true); }} />
        <Button testID="replace-cart-cancel" variant="ghost" title="Keep existing cart" onPress={() => setConflict(null)} />
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },

  /* Fixed Hero Background */
  fixedHeroContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT,
    backgroundColor: c.surfaceTertiary,
    overflow: "hidden",
    zIndex: 0,
  },
  heroDarkGradient: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.18)",
  },

  /* Fixed Back Button */
  fixedBackButtonWrapper: {
    position: "absolute",
    left: spacing.lg,
    zIndex: 20,
  },
  roundBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  /* List & Floating Card */
  listHeaderWrapper: {
    zIndex: 10,
  },
  floatingCard: {
    backgroundColor: c.surface,
    padding: spacing.lg,
    gap: 6,
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 15,
  },
  name: { fontSize: font.xxl, fontWeight: "800", color: c.onSurface, letterSpacing: -0.3 },
  cuisine: { color: c.muted },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rating: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: c.success, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  ratingText: { color: c.onSuccess, fontWeight: "800", fontSize: font.sm },
  meta: { color: c.onSurfaceSecondary, fontWeight: "600", fontSize: font.sm + 1 },
  offer: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.brandTertiary, alignSelf: "flex-start", paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
  offerText: { color: c.brandPrimary, fontWeight: "800", fontSize: font.sm },
  fssai: { color: c.muted, fontSize: font.sm },
  mode: { flexDirection: "row", gap: spacing.sm, alignItems: "center", backgroundColor: c.pastelLilac, padding: spacing.sm, borderRadius: radius.sm, marginTop: 4 },
  modeText: { color: c.onPastelLilac, fontWeight: "700", flex: 1, fontSize: font.sm + 1 },

  sectionHeaderBox: {
    backgroundColor: c.surface,
    zIndex: 5,
  },
  sectionTitle: {
    fontSize: font.lg,
    fontWeight: "800",
    color: c.onSurface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  item: {
    flexDirection: "row",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
    backgroundColor: c.surface,
  },
  pname: { fontSize: font.lg, fontWeight: "700", color: c.onSurface },
  pprice: { fontWeight: "700", color: c.onSurface },
  pdesc: { color: c.muted, fontSize: font.sm + 1 },
  pimg: { width: 116, height: 104, borderRadius: radius.md, backgroundColor: c.surfaceTertiary },
  bar: { position: "absolute", left: spacing.lg, right: spacing.lg },
  barInner: { height: 56, borderRadius: radius.md, backgroundColor: c.success, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  barText: { color: c.onSuccess, fontWeight: "800", fontSize: font.base + 1 },
}));
