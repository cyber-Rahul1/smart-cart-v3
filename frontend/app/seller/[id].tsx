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
import { AppImage, Button, ErrorState, Ionicons, Loader, Sheet, Stepper, useToast, VegMark } from "@/src/ui";

type ModeItem = { id: string; product_id: string; qty: number; user_id: string; flat?: string };

const HERO_HEIGHT = 240;
const ESTIMATED_CARD_HEIGHT = 175;

export default function SellerScreen() {
  const { id, gc, bk } = useLocalSearchParams<{ id: string; gc?: string; bk?: string }>();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const [conflict, setConflict] = useState<{ product_id: string; qty: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const { user } = useAuth();

  const toggleSection = (title: string) => {
    setCollapsedSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

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

  // The bottom edge of the hero image is at HERO_HEIGHT (240).
  // The card is centered vertically on that bottom edge:
  const halfCard = ESTIMATED_CARD_HEIGHT / 2;
  const initialCardTop = HERO_HEIGHT - halfCard;
  const dockTargetTop = insets.top;
  const maxScroll = Math.max(1, initialCardTop - dockTargetTop);

  // Smooth, jitter-free animation driven directly on the UI thread via transform translateY
  const cardAnimStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    const progress = Math.min(1, Math.max(0, y / maxScroll));

    // translateY moves the card up with scroll until it docks cleanly at insets.top
    const translateY = -Math.min(y, maxScroll);

    // Smooth horizontal expansion from spacing.lg (16) to 0 (full screen width)
    const left = interpolate(progress, [0, 1], [spacing.lg, 0]);
    const right = interpolate(progress, [0, 1], [spacing.lg, 0]);

    // Border radius smoothly flattens top corners upon docking
    const borderTopLeftRadius = interpolate(progress, [0, 1], [radius.lg, 0]);
    const borderTopRightRadius = interpolate(progress, [0, 1], [radius.lg, 0]);
    const borderBottomLeftRadius = interpolate(progress, [0, 1], [radius.lg, radius.md]);
    const borderBottomRightRadius = interpolate(progress, [0, 1], [radius.lg, radius.md]);

    return {
      transform: [{ translateY }],
      left,
      right,
      borderTopLeftRadius,
      borderTopRightRadius,
      borderBottomLeftRadius,
      borderBottomRightRadius,
    };
  });

  // Animated styles for back buttons crossfade & slide transition
  // Floating round button fades out as card docks (progress 0.6 -> 0.95)
  const floatingBackBtnAnimStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    const progress = Math.min(1, Math.max(0, y / maxScroll));
    const opacity = interpolate(progress, [0.5, 0.9], [1, 0]);
    const scale = interpolate(progress, [0.5, 0.9], [1, 0.8]);
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  // Title row inline back button on the card slides in from left & fades in as card docks (progress 0.75 -> 1)
  const cardBackBtnAnimStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    const progress = Math.min(1, Math.max(0, y / maxScroll));
    const opacity = interpolate(progress, [0.75, 1], [0, 1]);
    const translateX = interpolate(progress, [0.75, 1], [-16, 0]);
    return {
      opacity,
      transform: [{ translateX }],
    };
  });

  // Animated title style: shifts right by 32dp when docked so the inline back button sits comfortably beside it
  const cardTitleAnimStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    const progress = Math.min(1, Math.max(0, y / maxScroll));
    const paddingLeft = interpolate(progress, [0.75, 1], [0, 32]);
    return {
      paddingLeft,
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
  const rawSections = Object.entries(products.reduce<Record<string, Product[]>>((acc, p) => ((acc[p.category] ??= []).push(p), acc), {}))
    .map(([title, data]) => ({ title, data }));
  const sections = rawSections.map((s) => ({
    ...s,
    data: collapsedSections[s.title] ? [] : s.data,
    totalCount: s.data.length,
  }));
  const modeLabel = mode === "group" ? `Adding to shared cart: ${group.data?.name ?? ""}` : mode === "basket" ? `Adding to Flat ${basket.data?.my_flat ?? ""} · ${basket.data?.title ?? ""}` : null;

  return (
    <View style={s.root}>
      {/* 1. FIXED BACKGROUND HERO IMAGE */}
      <View style={s.fixedHeroContainer} pointerEvents="none">
        <Animated.View style={[StyleSheet.absoluteFill, bgImageAnimStyle]}>
          <AppImage
            source={{ uri: mediaUri(seller.image) }}
            fallbackType={seller.category === "grocery" ? "groceries" : "shop"}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        </Animated.View>
        <View style={s.heroDarkGradient} />
      </View>

      {/* 2. FLOATING FIXED BACK BUTTON (Visible over hero, fades out when card docks at the top) */}
      <Animated.View style={[s.fixedBackButtonWrapper, { top: insets.top + spacing.sm }, floatingBackBtnAnimStyle]}>
        <Pressable
          testID="seller-back-button"
          onPress={() => router.back()}
          style={s.roundBackBtn}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={18} color={colors.onSurface} />
        </Pressable>
      </Animated.View>

      {/* 3. SCROLLABLE MENU & SECTIONS:
             Covers the full screen with zIndex: 10 (above the fixed background hero image at zIndex: 0).
             Sections and items scroll smoothly ON TOP of the background image,
             but UNDER the floating card (which has zIndex: 30).
             ListHeaderComponent has:
               - Transparent spacer of height HERO_HEIGHT (hero is visible behind at initial view)
               - White spacer of height halfCard (so content starts cleanly below the centered card) */}
      <SectionList
        testID="seller-menu-list"
        style={s.sectionList}
        sections={sections}
        keyExtractor={(p) => p.id}
        stickySectionHeadersEnabled={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        ListHeaderComponent={
          <View pointerEvents="none">
            {/* Transparent region allowing the hero background image to show through */}
            <View style={{ height: HERO_HEIGHT }} />
            {/* White spacer behind bottom half of card, so first section starts right below the card */}
            <View style={{ height: halfCard + spacing.sm, backgroundColor: colors.surface }} />
          </View>
        }
        renderSectionHeader={({ section }) => {
          const isCollapsed = !!collapsedSections[section.title];
          return (
            <Pressable
              testID={`section-toggle-${section.title}`}
              style={s.sectionHeaderBox}
              onPress={() => toggleSection(section.title)}
            >
              <Text style={s.sectionTitle}>
                {section.title} ({section.totalCount})
              </Text>
              <View style={s.collapseIconBox}>
                <Ionicons
                  name={isCollapsed ? "chevron-down" : "chevron-up"}
                  size={20}
                  color={colors.onSurface}
                />
              </View>
            </Pressable>
          );
        }}
        renderItem={({ item: p }) => (
          <View style={s.item} testID={`product-${p.id}`}>
            <View style={{ flex: 1, gap: 6, paddingRight: spacing.sm }}>
              <VegMark veg={p.veg} />
              <Text style={s.pname}>{p.name}</Text>
              <Text style={s.pprice}>{rupee(p.price)}</Text>
              <Text style={s.pdesc} numberOfLines={2}>
                {p.available ? (p.stock < 10 ? `Only ${p.stock} left` : p.description) : "Currently unavailable"}
              </Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <AppImage
                source={{ uri: mediaUri(p.image) }}
                fallbackType={seller.category === "grocery" ? "groceries" : "food"}
                style={s.pimg}
                contentFit="cover"
                transition={150}
              />
              <View style={{ marginTop: -20 }}>
                <Stepper testID={`product-stepper-${p.id}`} qty={qtyOf(p.id)} disabled={!p.available || busy === p.id} onChange={(n) => change(p, n)} />
              </View>
            </View>
          </View>
        )}
      />

      {/* 4. DOCKED / FLOATING CARD (Vertically centered on the bottom edge of hero image; translates & docks smoothly without wiggling) */}
      <Animated.View style={[s.floatingCard, { top: initialCardTop }, cardAnimStyle]} pointerEvents="box-none">
        <View style={s.cardTitleRow}>
          {/* Animated back button positioned absolutely; slides & fades in beside title once docked */}
          <Animated.View style={[s.cardBackBtnWrapper, cardBackBtnAnimStyle]}>
            <Pressable
              testID="seller-docked-back-button"
              onPress={() => router.back()}
              style={s.cardBackBtn}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
            </Pressable>
          </Animated.View>
          <Animated.Text testID="seller-name" style={[s.name, cardTitleAnimStyle]} numberOfLines={1}>{seller.name}</Animated.Text>
        </View>
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
    zIndex: 50,
    elevation: 10,
  },
  roundBackBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  /* Floating Card docked/scaled */
  floatingCard: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: c.surface,
    padding: spacing.lg,
    gap: 6,
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 30,
    elevation: 6,
  },
  sectionList: {
    flex: 1,
    zIndex: 10,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  cardBackBtnWrapper: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    zIndex: 10,
  },
  cardBackBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: font.xxl, fontWeight: "800", color: c.onSurface, letterSpacing: -0.3, flexShrink: 1 },
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: font.lg,
    fontWeight: "800",
    color: c.onSurface,
    flex: 1,
  },
  collapseIconBox: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
    backgroundColor: c.surface,
  },
  pname: { fontSize: font.xl, fontWeight: "800", color: c.onSurface, letterSpacing: -0.2 },
  pprice: { fontSize: font.lg, fontWeight: "700", color: c.onSurface },
  pdesc: { color: c.muted, fontSize: font.base, lineHeight: 20 },
  pimg: { width: 136, height: 122, borderRadius: radius.lg, backgroundColor: c.surfaceTertiary },
  bar: { position: "absolute", left: spacing.lg, right: spacing.lg },
  barInner: { height: 56, borderRadius: radius.md, backgroundColor: c.success, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  barText: { color: c.onSuccess, fontWeight: "800", fontSize: font.base + 1 },
}));
