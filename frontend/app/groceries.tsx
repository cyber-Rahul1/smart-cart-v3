import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError } from "@/src/api";
import { AnimatedPlaceholder } from "@/src/components/animated-placeholder";
import { GroceryCard } from "@/src/components/grocery-card";
import { SellerTile } from "@/src/components/seller-card";
import { font, makeStyles, radius, spacing, ThemeColors, useTheme } from "@/src/theme";
import { Product, Seller } from "@/src/types";
import { Button, EmptyState, ErrorState, IconName, Ionicons, Loader, SectionTitle, Sheet, useToast } from "@/src/ui";

// Known aisles get a friendly icon + pastel; any new category a shop adds falls back to a basket tile.
const AISLES: Record<string, { icon: IconName; bg: keyof ThemeColors; fg: keyof ThemeColors }> = {
    Vegetables: { icon: "leaf-outline", bg: "pastelMint", fg: "onPastelMint" },
    Fruits: { icon: "nutrition-outline", bg: "pastelRose", fg: "onPastelRose" },
    Dairy: { icon: "water-outline", bg: "pastelSky", fg: "onPastelSky" },
    Bakery: { icon: "cafe-outline", bg: "pastelLemon", fg: "onPastelLemon" },
    Staples: { icon: "cube-outline", bg: "brandTertiary", fg: "onBrandTertiary" },
    Snacks: { icon: "fast-food-outline", bg: "pastelLilac", fg: "onPastelLilac" },
    Beverages: { icon: "beer-outline", bg: "pastelSky", fg: "onPastelSky" },
};
const FALLBACK = { icon: "basket-outline" as IconName, bg: "pastelMint" as keyof ThemeColors, fg: "onPastelMint" as keyof ThemeColors };

export default function Groceries() {
    const insets = useSafeAreaInsets();
    const s = useStyles();
    const { colors } = useTheme();
    const { width } = useWindowDimensions();
    const qc = useQueryClient();
    const toast = useToast();
    const [aisle, setAisle] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [conflict, setConflict] = useState<{ p: Product; qty: number } | null>(null);

    const collapseProgress = useSharedValue(0);
    const [titleRowHeight, setTitleRowHeight] = useState(56);
    const lastScrollY = useRef(0);
    const isHiddenRef = useRef(false);

    const TIMING_CONFIG = {
        duration: 260,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    };

    const handleGroceriesScroll = (e: any) => {
        const currentY = e.nativeEvent.contentOffset.y;
        const diff = currentY - lastScrollY.current;

        if (currentY <= 10) {
            if (isHiddenRef.current) {
                isHiddenRef.current = false;
                collapseProgress.value = withTiming(0, TIMING_CONFIG);
            }
        } else if (diff > 12 && currentY > 40) {
            if (!isHiddenRef.current) {
                isHiddenRef.current = true;
                collapseProgress.value = withTiming(1, TIMING_CONFIG);
            }
        } else if (diff < -12) {
            if (isHiddenRef.current) {
                isHiddenRef.current = false;
                collapseProgress.value = withTiming(0, TIMING_CONFIG);
            }
        }

        lastScrollY.current = currentY;
    };

    const titleRowAnimStyle = useAnimatedStyle(() => {
        const totalShift = titleRowHeight + spacing.xs;
        return {
            marginTop: -collapseProgress.value * totalShift,
            opacity: 1 - collapseProgress.value,
        };
    });

    const stores = useQuery({ queryKey: ["sellers", "grocery"], queryFn: () => api<Seller[]>("/sellers?category=grocery") });
    const menus = useQueries({
        queries: (stores.data ?? []).map((st) => ({ queryKey: ["seller", st.id], queryFn: () => api<{ seller: Seller; products: Product[] }>(`/sellers/${st.id}`) })),
    });
    const cart = useQuery({ queryKey: ["cart", null, false], queryFn: () => api<any>("/cart/quote", { method: "POST", body: {} }) });

    const products = useMemo(() => menus.flatMap((m) => (m.data ? m.data.products.map((p) => ({ ...p, seller_name: m.data!.seller.name })) : [])),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [menus.map((m) => m.dataUpdatedAt).join()]);
    const aisles = useMemo(() => [...new Set(products.map((p) => p.category))], [products]);
    const shown = aisle ? products.filter((p) => p.category === aisle) : products.filter((p) => p.available).slice(0, 8);

    const cartItems: { product_id: string; qty: number }[] = cart.data?.items ?? [];
    const qtyOf = (pid: string) => cartItems.find((i) => i.product_id === pid)?.qty ?? 0;
    const cartCount = cartItems.reduce((a, i) => a + i.qty, 0);
    const isGroceryCart = cart.data?.seller?.category === "grocery";

    const change = async (p: Product, qty: number, replace = false) => {
        setBusy(p.id);
        try {
            await api("/cart/items", { method: "POST", body: { product_id: p.id, qty, replace } });
            qc.invalidateQueries({ queryKey: ["cart"] });
        } catch (e) {
            if (e instanceof ApiError && e.status === 409) setConflict({ p, qty });
            else toast((e as Error).message, "err");
        } finally {
            setBusy(null);
        }
    };

    const gap = spacing.md;
    const cardW = (width - spacing.lg * 2 - gap) / 2;
    const refresh = () => { stores.refetch(); menus.forEach((m) => m.refetch()); cart.refetch(); };

    if (stores.isLoading) return <Loader />;
    if (stores.isError) return <ErrorState message={(stores.error as Error).message} onRetry={() => stores.refetch()} />;
    const loadingMenus = menus.some((m) => m.isLoading);

    return (
        <View style={s.root}>
            {/* Sticky Top Header */}
            <View
                style={{
                    position: "relative",
                    zIndex: 10,
                    overflow: "hidden",
                    borderBottomWidth: 1,
                    borderBottomColor: colors.divider,
                    backgroundColor: colors.surface,
                }}
            >
                {/* Collapsible Section ABOVE search: Small back button & Title & Subtitle */}
                <Animated.View
                    onLayout={(e) => {
                        const h = e.nativeEvent.layout.height;
                        if (h > 0 && Math.abs(h - titleRowHeight) > 2) {
                            setTitleRowHeight(h);
                        }
                    }}
                    style={[
                        {
                            paddingTop: insets.top + spacing.xs,
                            paddingHorizontal: spacing.lg,
                            paddingBottom: spacing.xs,
                            flexDirection: "row",
                            alignItems: "center",
                        },
                        titleRowAnimStyle,
                    ]}
                >
                    <Pressable
                        testID="groceries-back-button"
                        onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
                        style={({ pressed }) => [
                            {
                                width: 36,
                                height: 36,
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: spacing.xs,
                                marginLeft: -4,
                            },
                            pressed && { opacity: 0.6 },
                        ]}
                        hitSlop={8}
                    >
                        <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
                    </Pressable>
                    <View style={{ flex: 1 }}>
                        <Text style={s.title}>Groceries</Text>
                        <Text style={s.sub}>Kirana, fresh produce & dairy · delivered in minutes</Text>
                    </View>
                </Animated.View>

                {/* Sticky Search bar row (always visible!) */}
                <View
                    style={{
                        paddingHorizontal: spacing.lg,
                        paddingTop: spacing.md,
                        paddingBottom: spacing.lg,
                    }}
                >
                    <Pressable
                        testID="groceries-search-bar"
                        onPress={() => router.push("/search")}
                        style={{
                            height: 50,
                            borderRadius: radius.lg,
                            borderWidth: 1,
                            borderColor: "rgba(255, 255, 255, 0.9)",
                            backgroundColor: "rgba(255, 255, 255, 0.92)",
                            flexDirection: "row",
                            alignItems: "center",
                            gap: spacing.sm,
                            paddingHorizontal: spacing.lg,
                            shadowColor: colors.onSurface,
                            shadowOpacity: 0.08,
                            shadowRadius: 12,
                            shadowOffset: { width: 0, height: 4 },
                            elevation: 3,
                        }}
                    >
                        <Ionicons name="search" size={18} color={colors.brandPrimary} />
                        <View style={{ flex: 1, height: 46, justifyContent: "center", position: "relative" }}>
                            <AnimatedPlaceholder
                                placeholders={[
                                    "Search milk, atta, tomatoes...",
                                    "Try 'Fresh Vegetables'",
                                    "Try 'Paneer & Butter'",
                                    "Try 'Bread & Eggs'",
                                    "Try 'Snacks & Biscuits'",
                                    "Try 'Rice & Dal'",
                                ]}
                            />
                        </View>
                    </Pressable>
                </View>
            </View>

            <Animated.ScrollView
                testID="groceries-scroll"
                onScroll={handleGroceriesScroll}
                scrollEventThrottle={16}
                contentContainerStyle={{ paddingBottom: insets.bottom + (cartCount ? 96 : spacing.xl) }}
                refreshControl={<RefreshControl refreshing={stores.isRefetching} onRefresh={refresh} tintColor={colors.brandPrimary} />}>
                <View testID="groceries-offer-banner" style={s.banner}>
                    <View style={{ flex: 1, gap: 4 }}>
                        <Text style={s.bannerTitle}>Fresh stock, every morning</Text>
                        <Text style={s.bannerSub}>Use FRESH10 for 10% off groceries (up to ₹60)</Text>
                    </View>
                    <View style={s.bannerIcon}><Ionicons name="basket" size={30} color={colors.onPastelMint} /></View>
                </View>

                <SectionTitle title="Shop by category" />
                {loadingMenus && !aisles.length ? <Loader /> : (
                    <View style={s.aisles}>
                        {aisles.map((a) => {
                            const t = AISLES[a] ?? FALLBACK;
                            const on = aisle === a;
                            return (
                                <Pressable key={a} testID={`groceries-category-${a}`} onPress={() => setAisle(on ? null : a)} style={s.aisleWrap}>
                                    <View style={[s.aisle, { backgroundColor: colors[t.bg] as string }, on && { borderColor: colors.brandPrimary }]}>
                                        <Ionicons name={t.icon} size={26} color={colors[t.fg] as string} />
                                    </View>
                                    <Text style={[s.aisleLabel, on && { color: colors.brandPrimary }]} numberOfLines={1}>{a}</Text>
                                </Pressable>
                            );
                        })}
                    </View>
                )}

                <SectionTitle title={aisle ?? "Popular picks"} action={aisle ? "Show all" : undefined} testID="groceries-clear-category" onAction={() => setAisle(null)} />
                {shown.length ? (
                    <View testID="groceries-product-grid" style={[s.grid, { gap }]}>
                        {shown.map((p) => (
                            <GroceryCard key={p.id} p={p} width={cardW} qty={qtyOf(p.id)} busy={busy === p.id} onChange={(n) => change(p, n)}
                                onOpen={() => router.push(`/seller/${p.seller_id}`)} />
                        ))}
                    </View>
                ) : loadingMenus ? null : (
                    <EmptyState testID="groceries-empty" icon="basket-outline" title="Nothing here yet" body="Local grocery stores are adding products. Check back soon." />
                )}

                <SectionTitle title="Grocery stores near you" />
                {stores.data!.length ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
                        {stores.data!.map((st) => <SellerTile key={st.id} s={st} testID={`groceries-store-${st.id}`} />)}
                    </ScrollView>
                ) : <EmptyState icon="storefront-outline" title="No grocery stores nearby" body="We're onboarding kirana stores in your area." />}

                {menus.map((m) => m.data && m.data.products.length ? (
                    <View key={m.data.seller.id} testID={`groceries-store-section-${m.data.seller.id}`}>
                        <SectionTitle title={`From ${m.data.seller.name}`} action="View store" testID={`groceries-view-store-${m.data.seller.id}`}
                            onAction={() => router.push(`/seller/${m.data!.seller.id}`)} />
                        <Text style={s.storeMeta}>{m.data.seller.eta_min} mins · {m.data.seller.distance_km} km{m.data.seller.offer ? ` · ${m.data.seller.offer}` : ""}</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
                            {m.data.products.map((p) => (
                                <GroceryCard key={p.id} p={{ ...p, seller_name: m.data!.seller.name }} width={148} qty={qtyOf(p.id)} busy={busy === p.id}
                                    onChange={(n) => change(p, n)} onOpen={() => router.push(`/seller/${p.seller_id}`)} />
                            ))}
                        </ScrollView>
                    </View>
                ) : null)}
            </Animated.ScrollView>

            {cartCount > 0 && isGroceryCart ? (
                <View style={[s.bar, { bottom: insets.bottom + spacing.lg }]}>
                    <Pressable testID="groceries-view-cart-bar" style={s.barInner} onPress={() => router.push("/(tabs)/cart")}>
                        <Text style={s.barText}>{cartCount} item{cartCount > 1 ? "s" : ""} · {cart.data?.seller?.name}</Text>
                        <Text style={s.barText}>View cart  ›</Text>
                    </Pressable>
                </View>
            ) : null}

            <Sheet visible={!!conflict} onClose={() => setConflict(null)} title="Replace cart items?" testID="groceries-replace-sheet">
                <Text style={{ color: colors.onSurfaceSecondary, lineHeight: 20 }}>Your cart has items from another shop. Start a fresh cart with {conflict?.p.seller_name}?</Text>
                <Button testID="groceries-replace-confirm" title="Yes, start fresh" onPress={() => { const c = conflict!; setConflict(null); change(c.p, c.qty, true); }} />
                <Button testID="groceries-replace-cancel" variant="ghost" title="Keep existing cart" onPress={() => setConflict(null)} />
            </Sheet>
        </View>
    );
}

const useStyles = makeStyles((c) => ({
    root: { flex: 1, backgroundColor: c.surface },
    header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider, backgroundColor: c.surface },
    round: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surfaceSecondary, alignItems: "center", justifyContent: "center" },
    title: { fontSize: font.xl, fontWeight: "800", color: c.onSurface, letterSpacing: -0.3 },
    sub: { color: c.muted, fontSize: font.sm },
    search: { height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg },
    searchText: { color: c.muted, fontSize: font.base + 1 },
    banner: { margin: spacing.lg, marginBottom: 0, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: c.pastelMint, flexDirection: "row", alignItems: "center", gap: spacing.md },
    bannerTitle: { color: c.onPastelMint, fontWeight: "900", fontSize: font.lg },
    bannerSub: { color: c.onPastelMint, fontSize: font.sm + 1, fontWeight: "600" },
    bannerIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
    aisles: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.md },
    aisleWrap: { width: "25%", alignItems: "center", padding: spacing.xs, gap: 6, marginBottom: spacing.sm },
    aisle: { width: 64, height: 64, borderRadius: radius.md, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
    aisleLabel: { color: c.onSurface, fontWeight: "700", fontSize: font.sm },
    grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg },
    storeMeta: { color: c.muted, fontSize: font.sm, paddingHorizontal: spacing.lg, marginTop: -spacing.sm, marginBottom: spacing.md },
    bar: { position: "absolute", left: spacing.lg, right: spacing.lg },
    barInner: { height: 56, borderRadius: radius.md, backgroundColor: c.success, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg },
    barText: { color: c.onSuccess, fontWeight: "800", fontSize: font.base + 1 },
}));
