import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
    interpolate,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError } from "@/src/api";
import { AnimatedPlaceholder } from "@/src/components/animated-placeholder";
import { GroceryCard } from "@/src/components/grocery-card";
import { SellerTile } from "@/src/components/seller-card";
import { font, makeStyles, radius, spacing, ThemeColors, useTheme } from "@/src/theme";
import { Product, Seller } from "@/src/types";
import { AppImage, Button, EmptyState, ErrorState, IconName, Ionicons, Loader, SectionTitle, Sheet, useToast } from "@/src/ui";
import { useTabBarVisibility } from "@/src/context/tab-bar-visibility";
import { BrandFooter } from "@/src/components/brand-footer";
import { GroceriesSkeleton } from "@/src/components/groceries-skeleton";
import { FloatingCartBar } from "@/src/components/floating-cart-bar";
import ProductDetailModal from "@/src/components/product-detail-modal";
import { applyOptimisticCartItem } from "@/src/cart";
import { mediaUri } from "@/src/format";

const GROCERY_CATEGORIES = [
    { key: "All", label: "All" },
    { key: "Dairy", label: "Dairy" },
    { key: "Bakery", label: "Bakery" },
    { key: "Beverages", label: "Beverages" },
    { key: "Snacks", label: "Snacks" },
    { key: "Staples", label: "Staples" },
];

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
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
    const { tabBarTranslateY, setActiveTabIndex } = useTabBarVisibility();

    // Handle hardware / mobile back button: return to Home tab if no stack to pop
    useEffect(() => {
        const onBackPress = () => {
            if (router.canGoBack()) {
                router.back();
                return true;
            }
            setActiveTabIndex(0);
            return true;
        };

        const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
        return () => subscription.remove();
    }, [setActiveTabIndex]);

    const collapseProgress = useSharedValue(0);
    const stickyChipsProgress = useSharedValue(0);
    const [titleRowHeight, setTitleRowHeight] = useState(56);
    const lastScrollY = useRef(0);
    const isHiddenRef = useRef(false);
    const accumulatedDiff = useRef(0);
    const categorySectionY = useRef(350);

    const TIMING_CONFIG = {
        duration: 300,
        easing: Easing.out(Easing.cubic),
    };

    const handleGroceriesScroll = (e: any) => {
        const currentY = e.nativeEvent.contentOffset.y;
        const diff = currentY - lastScrollY.current;

        // Ignore tiny jitter/micro-drags
        if (Math.abs(diff) < 1) return;

        // Sticky filter pills trigger when scrolled past the category section
        const triggerY = Math.max(180, categorySectionY.current - 80);
        if (currentY >= triggerY) {
            if (stickyChipsProgress.value < 1) {
                stickyChipsProgress.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) });
            }
        } else {
            if (stickyChipsProgress.value > 0) {
                stickyChipsProgress.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) });
            }
        }

        // Only trigger when scrolled past top padding or pulled down
        if (currentY <= 15) {
            accumulatedDiff.current = 0;
            // At the very top, always show header and tab bar smoothly
            if (isHiddenRef.current || collapseProgress.value > 0) {
                isHiddenRef.current = false;
                collapseProgress.value = withTiming(0, TIMING_CONFIG);
                tabBarTranslateY.value = withTiming(0, TIMING_CONFIG);
            }
        } else {
            // Accumulate scroll displacement in consistent direction
            if ((diff > 0 && accumulatedDiff.current < 0) || (diff < 0 && accumulatedDiff.current > 0)) {
                accumulatedDiff.current = 0;
            }
            accumulatedDiff.current += diff;

            // Hysteresis threshold: requires intentional, sustained drag (>= 40px) before flipping
            if (accumulatedDiff.current > 40 && currentY > 60) {
                // User is intentionally scrolling content UP -> hide header & bottom tab bar
                if (!isHiddenRef.current) {
                    isHiddenRef.current = true;
                    collapseProgress.value = withTiming(1, TIMING_CONFIG);
                    tabBarTranslateY.value = withTiming(100, TIMING_CONFIG);
                }
            } else if (accumulatedDiff.current < -40) {
                // User is intentionally scrolling content DOWN -> reveal both smoothly from bottom
                if (isHiddenRef.current) {
                    isHiddenRef.current = false;
                    collapseProgress.value = withTiming(0, TIMING_CONFIG);
                    tabBarTranslateY.value = withTiming(0, TIMING_CONFIG);
                }
            }
        }

        lastScrollY.current = currentY;
    };

    const titleRowAnimStyle = useAnimatedStyle(() => {
        return {
            maxHeight: interpolate(collapseProgress.value, [0, 1], [60, 0]),
            opacity: interpolate(collapseProgress.value, [0, 0.7, 1], [1, 0.2, 0]),
            overflow: "hidden",
        };
    });

    const stickyChipsAnimStyle = useAnimatedStyle(() => {
        return {
            maxHeight: interpolate(stickyChipsProgress.value, [0, 1], [0, 56]),
            opacity: stickyChipsProgress.value,
            transform: [
                { translateY: interpolate(stickyChipsProgress.value, [0, 1], [-20, 0]) },
            ],
            pointerEvents: stickyChipsProgress.value > 0.5 ? ("auto" as const) : ("none" as const),
        };
    });

    const stores = useQuery({
        queryKey: ["sellers", "grocery"],
        queryFn: () => api<Seller[]>("/sellers?category=grocery"),
        staleTime: 60000,
    });
    const menus = useQueries({
        queries: (stores.data ?? []).map((st) => ({
            queryKey: ["seller", st.id],
            queryFn: () => api<{ seller: Seller; products: Product[] }>(`/sellers/${st.id}`),
            staleTime: 60000,
        })),
    });
    const cart = useQuery({
        queryKey: ["cart", null, false],
        queryFn: () => api<any>("/cart/quote", { method: "POST", body: {} }),
        staleTime: 5000,
    });

    const products = useMemo(() => menus.flatMap((m) => (m.data ? m.data.products.map((p) => ({ ...p, seller_name: m.data!.seller.name })) : [])),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [menus.map((m) => m.dataUpdatedAt).join()]);

    // Sort products so bread, milk, eggs, paneer come first for the Popular picks section
    const priority = ["Brown Bread", "Toned Milk 1L", "Farm Eggs (6)", "Paneer 200g", "Curd 500g"];
    const sortProducts = (list: Product[]) => {
        return [...list].sort((a, b) => {
            const idxA = priority.indexOf(a.name);
            const idxB = priority.indexOf(b.name);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return 0;
        });
    };

    const sortedProducts = useMemo(() => {
        return sortProducts(products);
    }, [products]);

    // Group items by store like in food section
    const storeGroups = useMemo(() => {
        const groups: { seller: Seller; products: Product[] }[] = [];
        for (const m of menus) {
            if (!m.data) continue;
            const seller = m.data.seller;
            const storeProducts = m.data.products.map((p) => ({ ...p, seller_name: seller.name }));
            const filtered = aisle && aisle !== "All"
                ? storeProducts.filter((p) => p.category.toLowerCase() === aisle.toLowerCase())
                : storeProducts.filter((p) => p.available);
            if (filtered.length > 0) {
                groups.push({
                    seller,
                    products: sortProducts(filtered),
                });
            }
        }
        return groups;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [menus.map((m) => m.dataUpdatedAt).join(), aisle]);

    const shown = aisle && aisle !== "All"
        ? sortedProducts.filter((p) => p.category.toLowerCase() === aisle.toLowerCase())
        : sortedProducts.filter((p) => p.available);

    const cartItems: { product_id: string; qty: number }[] = cart.data?.items ?? [];
    const qtyOf = (pid: string) => cartItems.find((i) => i.product_id === pid)?.qty ?? 0;
    const cartCount = cartItems.reduce((a, i) => a + i.qty, 0);
    const isGroceryCart = cart.data?.seller?.category === "grocery";

    const change = async (p: Product, qty: number, replace = false) => {
        // Immediate optimistic UI update - button flips and count increments in 0ms
        const rollback = applyOptimisticCartItem(p, qty);
        try {
            await api("/cart/items", { method: "POST", body: { product_id: p.id, qty, replace } });
            qc.invalidateQueries({ queryKey: ["cart"] });
        } catch (e) {
            rollback();
            if (e instanceof ApiError && e.status === 409) setConflict({ p, qty });
            else toast((e as Error).message, "err");
        }
    };

    const gap = 12;
    const cardW = (width - spacing.lg * 2 - gap) / 2;
    const refresh = () => { stores.refetch(); menus.forEach((m) => m.refetch()); cart.refetch(); };

    if (stores.isLoading) return <GroceriesSkeleton />;
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
                    borderBottomWidth: 0,
                    backgroundColor: "transparent",
                    paddingTop: insets.top + spacing.xs,
                }}
            >
                {/* Collapsible Section ABOVE search: Small back button & Title & Subtitle */}
                <Animated.View
                    style={[
                        {
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
                        <Ionicons name="arrow-back" size={24} color="#0F172A" />
                    </Pressable>
                    <View style={{ flex: 1 }}>
                        <Text style={s.title}>Groceries</Text>
                        <Text style={s.sub}>Kirana, fresh produce & dairy · delivered in minutes</Text>
                    </View>

                    {/* Cart icon with badge */}
                    <Pressable
                        onPress={() => {
                            router.push("/cart");
                        }}
                        style={s.topCartBtn}
                    >
                        <Ionicons name="cart-outline" size={24} color="#0F172A" />
                        {cartCount > 0 ? (
                            <View style={s.topCartBadge}>
                                <Text style={s.topCartBadgeText}>{cartCount > 9 ? "9+" : cartCount}</Text>
                            </View>
                        ) : null}
                    </Pressable>
                </Animated.View>

                {/* Sticky Search bar row */}
                <View
                    style={{
                        paddingHorizontal: spacing.lg,
                        paddingTop: spacing.xs,
                        paddingBottom: spacing.sm,
                    }}
                >
                    <Pressable
                        testID="groceries-search-bar"
                        onPress={() => router.push("/search?type=grocery")}
                        style={s.searchBarBox}
                    >
                        <Ionicons name="search" size={19} color="#E11D48" />
                        <View style={{ flex: 1, height: 38, justifyContent: "center", position: "relative" }}>
                            <AnimatedPlaceholder
                                placeholders={[
                                    "Search for milk, bread, fruits...",
                                    "Try 'Fresh Vegetables'",
                                    "Try 'Paneer & Butter'",
                                    "Try 'Bread & Eggs'",
                                    "Try 'Snacks & Biscuits'",
                                    "Try 'Rice & Dal'",
                                ]}
                            />
                        </View>
                        <Ionicons name="mic" size={20} color="#E11D48" />
                    </Pressable>
                </View>

                {/* Collapsible Horizontal Category Filter Pills below Search Bar */}
                <Animated.View style={[s.stickyChipsContainer, stickyChipsAnimStyle]}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={s.categoryPillsScroll}
                        keyboardShouldPersistTaps="handled"
                    >
                        {GROCERY_CATEGORIES.map((c) => {
                            const isSelected = (!aisle && c.key === "All") || (aisle === c.key);
                            return (
                                <Pressable
                                    key={`sticky-${c.key}`}
                                    testID={`sticky-groceries-cat-${c.key}`}
                                    onPress={() => setAisle(c.key === "All" ? null : c.key)}
                                    style={({ pressed }) => [
                                        s.categoryPill,
                                        isSelected ? s.categoryPillActive : s.categoryPillInactive,
                                        pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            s.categoryPillText,
                                            isSelected ? s.categoryPillTextActive : s.categoryPillTextInactive,
                                        ]}
                                    >
                                        {c.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                </Animated.View>
            </View>

            <Animated.ScrollView
                testID="groceries-scroll"
                onScroll={handleGroceriesScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + (cartCount ? 120 : spacing.xl) }}
                refreshControl={<RefreshControl refreshing={stores.isRefetching} onRefresh={refresh} tintColor={colors.brandPrimary} />}
            >
                {/* 1. Hero Banner matching reference image exactly */}
                <View style={s.heroBanner}>
                    {/* Clean background image with no blurry gradient */}
                    <Image
                        source={require("@/assets/images/grocery_banner.jpg")}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                    />

                    {/* Left content positioned over the clean banner */}
                    <View style={s.heroLeftCol}>
                        {/* Daily Essentials Capsule Pill */}
                        <View style={s.dailyTag}>
                            <Ionicons name="flash" size={13} color="#EAB308" />
                            <Text style={s.dailyTagText}>Daily Essentials</Text>
                        </View>

                        {/* Title: Fresh groceries at your doorstep */}
                        <View style={{ marginTop: 6, marginBottom: 2 }}>
                            <Text style={s.heroTitle}>Fresh groceries</Text>
                            <Text style={s.heroTitleSecondRow}>
                                at your <Text style={s.heroTitleHighlight}>doorstep</Text>
                            </Text>
                            {/* Organic green flourish curve underline under doorstep */}
                            <View style={s.curveUnderline} />
                        </View>

                        {/* Fast delivery | Quality assured */}
                        <View style={s.heroFeaturesRow}>
                            <View style={s.heroFeatureItem}>
                                <Ionicons name="bicycle-outline" size={15} color="#166534" />
                                <Text style={s.heroFeatureText}>Fast delivery</Text>
                            </View>
                            <View style={s.heroFeatureDivider} />
                            <View style={s.heroFeatureItem}>
                                <Ionicons name="checkmark-circle" size={15} color="#166534" />
                                <Text style={s.heroFeatureText}>Quality assured</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* 3. Shop by category row */}
                <View
                    onLayout={(e) => {
                        categorySectionY.current = e.nativeEvent.layout.y;
                    }}
                    style={s.categoryHeaderRow}
                >
                    <View style={s.sectionTitleWithIconRow}>
                        <View style={[s.titleIconBadge, { backgroundColor: "#DCFCE7" }]}>
                            <Ionicons name="grid" size={17} color="#16A34A" />
                        </View>
                        <Text style={s.sectionTitleText}>Shop by category</Text>
                    </View>
                </View>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.categoryPillsScroll}
                >
                    {GROCERY_CATEGORIES.map((c) => {
                        const isSelected = (!aisle && c.key === "All") || (aisle === c.key);
                        return (
                            <Pressable
                                key={c.key}
                                onPress={() => setAisle(c.key === "All" ? null : c.key)}
                                style={({ pressed }) => [
                                    s.categoryPill,
                                    isSelected ? s.categoryPillActive : s.categoryPillInactive,
                                    pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                                ]}
                            >
                                <Text
                                    style={[
                                        s.categoryPillText,
                                        isSelected ? s.categoryPillTextActive : s.categoryPillTextInactive,
                                    ]}
                                >
                                    {c.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>

                {/* 4. Popular picks header & Grid */}
                {Boolean(aisle && aisle !== "All") && (
                    <View style={s.popularHeaderRow}>
                        <View style={s.sectionTitleWithIconRow}>
                            {/* <View style={[s.titleIconBadge, { backgroundColor: "#FEF3C7" }]}>
                                <Ionicons name="filter" size={16} color="#D97706" />
                            </View> */}
                            <Text style={s.sectionTitleText}>Showing filters for {aisle}</Text>
                        </View>
                        <Pressable
                            onPress={() => setAisle(null)}
                            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                            hitSlop={8}
                        >
                            <Text style={{ fontSize: 13, fontWeight: "700", color: "#F43F5E" }}>See all</Text>
                            <Ionicons name="arrow-forward" size={14} color="#F43F5E" />
                        </Pressable>
                    </View>
                )}


                {storeGroups.length > 0 ? (
                    <View style={{ gap: spacing.lg, paddingTop: aisle && aisle !== "All" ? 8 : 20 }}>
                        {storeGroups.map(({ seller, products: storeProducts }, gIdx) => (
                            <View key={seller.id} style={{ gap: spacing.sm }}>
                                {/* Clean Shop Header like Food page */}
                                <View style={s.storeHeaderContainer}>
                                    <View style={s.storeHeaderRow}>
                                        {/* Avatar & Name info */}
                                        <Pressable
                                            onPress={() => router.push(`/seller/${seller.id}`)}
                                            style={s.storeInfoRow}
                                            hitSlop={6}
                                        >
                                            <View style={s.storeAvatarBox}>
                                                <AppImage
                                                    source={{ uri: mediaUri(seller.image) }}
                                                    fallbackType="groceries"
                                                    style={StyleSheet.absoluteFill}
                                                    contentFit="cover"
                                                />
                                            </View>
                                            <View style={{ marginLeft: 10, flex: 1 }}>
                                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                                    <Text style={s.storeNameText} numberOfLines={1}>
                                                        {seller.name}
                                                    </Text>
                                                    {seller.is_new && (
                                                        <View style={s.newBadge}>
                                                            <Text style={s.newBadgeText}>NEW</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text style={s.storeCategorySub} numberOfLines={1}>
                                                    {seller.cuisine || "Kirana & Essentials"}
                                                </Text>
                                            </View>
                                        </Pressable>

                                        {/* Rating badge */}
                                        <View style={s.ratingBadge}>
                                            <Ionicons name="star" size={11} color="#FFFFFF" />
                                            <Text style={s.ratingBadgeText}>
                                                {seller.rating ? seller.rating.toFixed(1) : "4.2"}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Delivery / Distance snippet & View store */}
                                    <View style={s.storeSnippetRow}>
                                        <View style={s.storeSnippetItem}>
                                            <Ionicons name="time-outline" size={12} color="#64748B" />
                                            <Text style={s.storeSnippetText}>
                                                {seller.eta_min || 25} mins
                                            </Text>
                                        </View>
                                        <Text style={s.storeSnippetDot}>•</Text>
                                        <View style={s.storeSnippetItem}>
                                            <Ionicons name="location-outline" size={12} color="#64748B" />
                                            <Text style={s.storeSnippetText}>
                                                {seller.distance_km || 1.8} km
                                            </Text>
                                        </View>
                                        {seller.offer && (
                                            <>
                                                <Text style={s.storeSnippetDot}>•</Text>
                                                <View style={s.storeSnippetItem}>
                                                    <Ionicons name="pricetag" size={11} color="#E65100" />
                                                    <Text style={s.storeOfferText}>
                                                        {seller.offer}
                                                    </Text>
                                                </View>
                                            </>
                                        )}
                                        <Pressable
                                            onPress={() => router.push(`/seller/${seller.id}`)}
                                            style={s.viewStoreBtn}
                                            hitSlop={8}
                                        >
                                            <Text style={s.viewStoreText}>View store</Text>
                                            <Ionicons name="chevron-forward" size={14} color="#EA580C" />
                                        </Pressable>
                                    </View>
                                </View>

                                {/* Product Grid for this Store */}
                                <View testID={`groceries-product-grid-${seller.id}`} style={s.productsGrid}>
                                    {storeProducts.map((p) => (
                                        <GroceryCard
                                            key={p.id}
                                            p={p}
                                            width={cardW}
                                            qty={qtyOf(p.id)}
                                            busy={busy === p.id}
                                            onChange={(n) => change(p, n)}
                                            onOpen={() => {
                                                setSelectedProduct(p);
                                                setSelectedSeller(seller);
                                            }}
                                        />
                                    ))}
                                </View>

                                {gIdx < storeGroups.length - 1 && (
                                    <View style={s.storeGroupDivider} />
                                )}
                            </View>
                        ))}
                    </View>
                ) : loadingMenus ? <Loader /> : (
                    <EmptyState testID="groceries-empty" icon="basket-outline" title="Nothing here yet" body="Local grocery stores are adding products. Check back soon." />
                )}

                {/* 5. Grocery stores near you */}
                <SectionTitle title="Grocery stores near you" />
                {stores.data!.length ? (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={s.storesScrollContent}
                    >
                        {stores.data!.map((st) => <SellerTile key={st.id} s={st} testID={`groceries-store-${st.id}`} />)}
                    </ScrollView>
                ) : <EmptyState icon="storefront-outline" title="No grocery stores nearby" body="We're onboarding kirana stores in your area." />}

                <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.md }}>
                    <BrandFooter title={"Shop\nLocal!"} />
                </View>
            </Animated.ScrollView>

            <FloatingCartBar
                bottomOffset={insets.bottom > 0 ? insets.bottom + 52 : 60}
                dockSide="left"
            />

            {/* Product Detail Bottom Sheet Modal */}
            <ProductDetailModal
                visible={!!selectedProduct}
                product={selectedProduct}
                seller={selectedSeller}
                currentQty={selectedProduct ? qtyOf(selectedProduct.id) : 0}
                onClose={() => {
                    setSelectedProduct(null);
                    setSelectedSeller(null);
                }}
                onAddToCart={(p, qty) => {
                    change(p, qty);
                }}
            />
        </View>
    );
}

const useStyles = makeStyles((c) => ({
    root: { flex: 1, backgroundColor: "#FFFFFF" },
    title: { fontSize: 17, fontWeight: "900", color: "#0F172A", letterSpacing: -0.3 },
    sub: { color: "#64748B", fontSize: 12, marginTop: 1 },
    topCartBtn: {
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
    },
    topCartBadge: {
        position: "absolute",
        top: 0,
        right: 0,
        backgroundColor: "#16A34A",
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 2,
    },
    topCartBadgeText: {
        color: "#FFFFFF",
        fontSize: 9.5,
        fontWeight: "900",
    },

    // Search bar
    searchBarBox: {
        height: 48,
        borderRadius: 24,
        backgroundColor: "#FFFFFF",
        overflow: "hidden",
        position: "relative",
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: 16,
        shadowColor: "#000000",
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
    },

    // 1. Hero Banner
    heroBanner: {
        marginHorizontal: spacing.lg,
        marginTop: 10,
        borderRadius: 22,
        overflow: "hidden",
        height: 195,
        flexDirection: "row",
        position: "relative",
    },
    heroLeftCol: {
        width: "55%",
        paddingTop: 16,
        paddingBottom: 16,
        paddingLeft: 18,
        justifyContent: "space-between",
        zIndex: 2,
    },
    dailyTag: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: "rgba(255, 255, 255, 0.90)",
        paddingHorizontal: 11,
        paddingVertical: 5,
        borderRadius: 20,
        alignSelf: "flex-start",
        borderWidth: 1,
        borderColor: "rgba(226, 232, 240, 0.6)",
    },
    dailyTagText: {
        fontSize: 12,
        fontWeight: "800",
        color: "#166534",
    },
    heroTitle: {
        fontSize: 22,
        fontWeight: "900",
        color: "#0F172A",
        letterSpacing: -0.6,
        lineHeight: 27,
    },
    heroTitleSecondRow: {
        fontSize: 22,
        fontWeight: "900",
        color: "#0F172A",
        letterSpacing: -0.6,
        lineHeight: 27,
    },
    heroTitleHighlight: {
        color: "#15803D",
        fontWeight: "900",
    },
    curveUnderline: {
        width: 68,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: "#22C55E",
        marginTop: 4,
    },
    heroFeaturesRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 4,
    },
    heroFeatureItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    heroFeatureDivider: {
        width: 1,
        height: 12,
        backgroundColor: "#CBD5E1",
    },
    heroFeatureText: {
        fontSize: 11.5,
        fontWeight: "700",
        color: "#1E293B",
    },

    // 2. Feature Strip
    featureStrip: {
        marginHorizontal: spacing.lg,
        marginTop: 12,
        backgroundColor: "#ECFDF5",
        borderRadius: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: "rgba(167, 243, 208, 0.5)",
    },
    featureItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        flex: 1,
        justifyContent: "center",
    },
    featureItemTitle: {
        fontSize: 11.5,
        fontWeight: "800",
        color: "#0F172A",
        lineHeight: 14,
    },
    stripDivider: {
        width: 1,
        height: 24,
        backgroundColor: "rgba(167, 243, 208, 0.8)",
    },

    // 3. Category Section
    categoryHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.lg,
        marginTop: 22,
        marginBottom: 12,
    },
    sectionTitleText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#0F172A",
        opacity: 0.7,

        letterSpacing: -0.3,
    },
    stickyChipsContainer: {
        position: "relative",
        zIndex: 5,
        overflow: "hidden",
        backgroundColor: "transparent",
        paddingTop: 2,
        paddingBottom: spacing.sm,
    },
    categoryPillsScroll: {
        paddingHorizontal: spacing.lg,
        gap: 8,
        alignItems: "center",
    },
    categoryPill: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        overflow: "hidden",
        position: "relative",
    },
    categoryPillActive: {
        backgroundColor: "#E11D48",
        borderColor: "#E11D48",
        shadowColor: "#E11D48",
        shadowOpacity: 0.25,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
    },
    categoryPillInactive: {
        backgroundColor: "transparent",
        borderColor: "#E2E8F0",
    },
    categoryPillText: {
        fontSize: 12.5,
        letterSpacing: -0.1,
    },
    categoryPillTextActive: {
        color: "#FFFFFF",
        fontWeight: "800",
    },
    categoryPillTextInactive: {
        color: "#475569",
        fontWeight: "600",
    },

    // 4. Popular picks
    popularHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingHorizontal: spacing.lg,
        marginTop: 22,
        gap: 10,
        marginBottom: 4,
        opacity: 0.5,
        fontSize: 12,
        fontWeight: 500
    },
    sectionTitleWithIconRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    titleIconBadge: {
        width: 34,
        height: 34,
        borderRadius: 11,
        alignItems: "center",
        justifyContent: "center",
    },
    seeAllRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    seeAllText: {
        fontSize: 13,
        fontWeight: "700",
        color: "#16A34A",
    },
    productsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
        paddingHorizontal: spacing.lg,
    },

    // Store Section Header (matching food page style)
    storeHeaderContainer: {
        paddingHorizontal: spacing.lg,
        backgroundColor: "transparent",
    },
    storeHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: spacing.xs,
        paddingBottom: 4,
    },
    storeInfoRow: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        marginRight: spacing.sm,
    },
    storeAvatarBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        overflow: "hidden",
        borderWidth: 1.5,
        borderColor: "#E2E8F0",
        backgroundColor: "#F8FAFC",
    },
    storeNameText: {
        fontSize: font.lg + 1,
        fontWeight: "900",
        color: "#0F172A",
        letterSpacing: -0.2,
    },
    newBadge: {
        backgroundColor: "#FFF8E1",
        borderWidth: 1,
        borderColor: "#FFE082",
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
    },
    newBadgeText: {
        fontSize: 9,
        fontWeight: "800",
        color: "#FF8F00",
        letterSpacing: 0.3,
    },
    storeCategorySub: {
        fontSize: font.sm,
        color: "#64748B",
        marginTop: 1,
        fontWeight: "500",
    },
    ratingBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#2E7D32",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        gap: 3,
    },
    ratingBadgeText: {
        color: "#FFFFFF",
        fontWeight: "900",
        fontSize: 11,
    },
    storeSnippetRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 4,
    },
    storeSnippetItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
    },
    storeSnippetText: {
        fontSize: font.sm - 1,
        color: "#64748B",
        fontWeight: "600",
    },
    storeSnippetDot: {
        color: "#CBD5E1",
        fontSize: font.sm - 2,
    },
    storeOfferText: {
        fontSize: font.sm - 1,
        color: "#E65100",
        fontWeight: "800",
    },
    viewStoreBtn: {
        marginLeft: "auto",
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 2,
        paddingHorizontal: 4,
    },
    viewStoreText: {
        fontSize: font.sm,
        fontWeight: "800",
        color: "#EA580C",
    },
    storeGroupDivider: {
        height: 1,
        backgroundColor: "rgba(244, 63, 94, 0.08)",
        marginHorizontal: spacing.lg,
        marginTop: spacing.md,
        borderRadius: 1,
    },
    storesScrollContent: {
        paddingHorizontal: spacing.lg,
        paddingTop: 4,
        paddingBottom: 16,
        gap: spacing.md,
    },

    // Bottom cart bar
    bar: {
        position: "absolute",
        left: spacing.lg,
        right: spacing.lg,
        zIndex: 999,
        elevation: 20,
    },
    barInner: {
        height: 54,
        borderRadius: 12,
        backgroundColor: "#16A34A",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.lg,
        shadowColor: "#000000",
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 10,
    },
    barText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
}));
