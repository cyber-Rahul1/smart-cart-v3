import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
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
import { navigateToTab } from "@/src/context/tab-bar-visibility";

const GROCERY_CATEGORIES = [
  { key: "All", label: "All", icon: "grid-outline", isIcon: true },
  { key: "Bakery", label: "Bakery", image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&q=70" },
  { key: "Dairy", label: "Dairy", image: "https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=400&q=70" },
  { key: "Beverages", label: "Beverages", image: "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400&q=70" },
  { key: "Snacks", label: "Snacks", image: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&q=70" },
  { key: "Staples", label: "Staples", image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=70" },
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
    
    // Sort products so bread, milk, eggs, paneer come first for the Popular picks section
    const sortedProducts = useMemo(() => {
        const priority = ["Brown Bread", "Toned Milk 1L", "Farm Eggs (6)", "Paneer 200g", "Curd 500g"];
        return [...products].sort((a, b) => {
            const idxA = priority.indexOf(a.name);
            const idxB = priority.indexOf(b.name);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return 0;
        });
    }, [products]);

    const shown = aisle && aisle !== "All"
        ? sortedProducts.filter((p) => p.category.toLowerCase() === aisle.toLowerCase())
        : sortedProducts.filter((p) => p.available);

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

    const gap = 12;
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
                    borderBottomWidth: 0,
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
                        <Ionicons name="arrow-back" size={24} color="#0F172A" />
                    </Pressable>
                    <View style={{ flex: 1 }}>
                        <Text style={s.title}>Groceries</Text>
                        <Text style={s.sub}>Kirana, fresh produce & dairy · delivered in minutes</Text>
                    </View>

                    {/* Cart icon with badge */}
                    <Pressable
                        onPress={() => {
                            navigateToTab(2);
                            router.back();
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
                        onPress={() => router.push("/search")}
                        style={s.searchBarBox}
                    >
                        <Ionicons name="search" size={20} color="#0F172A" />
                        <View style={{ flex: 1, height: 46, justifyContent: "center", position: "relative" }}>
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
                        <Ionicons name="mic-outline" size={20} color="#0F172A" />
                    </Pressable>
                </View>
            </View>

            <Animated.ScrollView
                testID="groceries-scroll"
                onScroll={handleGroceriesScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + (cartCount ? 96 : spacing.xl) }}
                refreshControl={<RefreshControl refreshing={stores.isRefetching} onRefresh={refresh} tintColor={colors.brandPrimary} />}
            >
                {/* 1. Hero Banner matching reference image */}
                <View style={s.heroBanner}>
                    <Image
                        source={{ uri: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&q=80" }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                    />
                    <LinearGradient
                        colors={["rgba(232, 245, 233, 0.94)", "rgba(241, 248, 233, 0.82)", "rgba(255, 255, 255, 0.3)"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                    />
                    <View style={s.heroLeftCol}>
                        <View style={s.dailyTag}>
                            <Ionicons name="flash" size={13} color="#EAB308" />
                            <Text style={s.dailyTagText}>Daily Essentials</Text>
                        </View>
                        <Text style={s.heroTitle}>Fresh groceries{"\n"}at your doorstep</Text>
                        
                        <View style={s.heroFeaturesRow}>
                            <View style={s.heroFeatureItem}>
                                <Ionicons name="bicycle" size={14} color="#15803D" />
                                <Text style={s.heroFeatureText}>Fast delivery</Text>
                            </View>
                            <View style={s.heroFeatureDivider} />
                            <View style={s.heroFeatureItem}>
                                <Ionicons name="shield-checkmark" size={14} color="#15803D" />
                                <Text style={s.heroFeatureText}>Quality assured</Text>
                            </View>
                        </View>

                        {/* Carousel indicator dots */}
                        <View style={s.heroDotsRow}>
                            <View style={[s.heroDot, s.heroDotActive]} />
                            <View style={s.heroDot} />
                            <View style={s.heroDot} />
                        </View>
                    </View>
                </View>

                {/* 2. Feature highlights strip matching reference */}
                <View style={s.featureStrip}>
                    <View style={s.featureItem}>
                        <Ionicons name="flash" size={16} color="#16A34A" />
                        <View>
                            <Text style={s.featureItemTitle}>Quick</Text>
                            <Text style={s.featureItemTitle}>Delivery</Text>
                        </View>
                    </View>
                    <View style={s.stripDivider} />
                    <View style={s.featureItem}>
                        <Ionicons name="pricetag" size={16} color="#16A34A" />
                        <View>
                            <Text style={s.featureItemTitle}>Great</Text>
                            <Text style={s.featureItemTitle}>Offers</Text>
                        </View>
                    </View>
                    <View style={s.stripDivider} />
                    <View style={s.featureItem}>
                        <Ionicons name="leaf" size={16} color="#16A34A" />
                        <View>
                            <Text style={s.featureItemTitle}>Fresh</Text>
                            <Text style={s.featureItemTitle}>& Safe</Text>
                        </View>
                    </View>
                    <View style={s.stripDivider} />
                    <View style={s.featureItem}>
                        <Ionicons name="shield-checkmark" size={16} color="#16A34A" />
                        <View>
                            <Text style={s.featureItemTitle}>Trusted</Text>
                            <Text style={s.featureItemTitle}>Shops</Text>
                        </View>
                    </View>
                </View>

                {/* 3. Shop by category row */}
                <View style={s.categoryHeaderRow}>
                    <Text style={s.sectionTitleText}>Shop by category</Text>
                    <Ionicons name="chevron-down" size={18} color="#0F172A" />
                </View>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.categoryListScroll}
                >
                    {GROCERY_CATEGORIES.map((c) => {
                        const isSelected = (!aisle && c.key === "All") || (aisle === c.key);
                        return (
                            <Pressable
                                key={c.key}
                                onPress={() => setAisle(c.key === "All" ? null : c.key)}
                                style={s.categoryCardItem}
                            >
                                <View style={[s.categoryIconBox, isSelected && s.categoryIconBoxActive]}>
                                    {c.isIcon ? (
                                        <Ionicons name="grid-outline" size={24} color={isSelected ? "#16A34A" : "#64748B"} />
                                    ) : (
                                        <Image
                                            source={{ uri: c.image }}
                                            style={s.categoryImg}
                                            contentFit="cover"
                                        />
                                    )}
                                </View>
                                <Text style={[s.categoryLabel, isSelected && s.categoryLabelActive]} numberOfLines={1}>
                                    {c.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>

                {/* 4. Popular picks header & Grid */}
                <View style={s.popularHeaderRow}>
                    <Text style={s.sectionTitleText}>{aisle && aisle !== "All" ? aisle : "Popular picks"}</Text>
                    <Pressable
                        style={s.seeAllRow}
                        onPress={() => setAisle(null)}
                    >
                        <Text style={s.seeAllText}>See all</Text>
                        <Ionicons name="arrow-forward" size={14} color="#16A34A" />
                    </Pressable>
                </View>

                {shown.length ? (
                    <View testID="groceries-product-grid" style={s.productsGrid}>
                        {shown.map((p) => (
                            <GroceryCard
                                key={p.id}
                                p={p}
                                width={cardW}
                                qty={qtyOf(p.id)}
                                busy={busy === p.id}
                                onChange={(n) => change(p, n)}
                                onOpen={() => router.push(`/seller/${p.seller_id}`)}
                            />
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
            </Animated.ScrollView>

            {cartCount > 0 && isGroceryCart ? (
                <View style={[s.bar, { bottom: insets.bottom + spacing.lg }]}>
                    <Pressable
                        testID="groceries-view-cart-bar"
                        style={s.barInner}
                        onPress={() => {
                            navigateToTab(2);
                            router.back();
                        }}
                    >
                        <Text style={s.barText}>{cartCount} item{cartCount > 1 ? "s" : ""} · {cart.data?.seller?.name}</Text>
                        <Text style={s.barText}>View cart  ›</Text>
                    </Pressable>
                </View>
            ) : null}
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
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        backgroundColor: "#FFFFFF",
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
    },

    // 1. Hero Banner
    heroBanner: {
        marginHorizontal: spacing.lg,
        marginTop: 10,
        borderRadius: 16,
        overflow: "hidden",
        height: 180,
        flexDirection: "row",
        position: "relative",
    },
    heroLeftCol: {
        flex: 1,
        padding: 16,
        justifyContent: "space-between",
        zIndex: 2,
    },
    dailyTag: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: "#DCFCE7",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        alignSelf: "flex-start",
    },
    dailyTagText: {
        fontSize: 11,
        fontWeight: "800",
        color: "#166534",
    },
    heroTitle: {
        fontSize: 20,
        fontWeight: "900",
        color: "#0F172A",
        letterSpacing: -0.5,
        lineHeight: 25,
    },
    heroFeaturesRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    heroFeatureItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    heroFeatureDivider: {
        width: 1,
        height: 10,
        backgroundColor: "#94A3B8",
    },
    heroFeatureText: {
        fontSize: 11,
        fontWeight: "700",
        color: "#0F172A",
    },
    heroDotsRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    heroDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#CBD5E1",
    },
    heroDotActive: {
        width: 16,
        backgroundColor: "#166534",
    },
    heroImgWrap: {
        width: "48%",
        height: "100%",
        position: "absolute",
        right: 0,
        bottom: 0,
        top: 0,
    },
    heroImg: {
        width: "100%",
        height: "100%",
    },

    // 2. Feature Strip
    featureStrip: {
        marginHorizontal: spacing.lg,
        marginTop: 14,
        backgroundColor: "#F0FDF4",
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    featureItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    featureItemTitle: {
        fontSize: 11.5,
        fontWeight: "700",
        color: "#0F172A",
        lineHeight: 14,
    },
    stripDivider: {
        width: 1,
        height: 20,
        backgroundColor: "#DCFCE7",
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
        fontSize: 18,
        fontWeight: "900",
        color: "#0F172A",
        letterSpacing: -0.3,
    },
    categoryListScroll: {
        paddingHorizontal: spacing.lg,
        gap: 12,
    },
    categoryCardItem: {
        alignItems: "center",
        gap: 6,
        width: 68,
    },
    categoryIconBox: {
        width: 68,
        height: 68,
        borderRadius: 14,
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
    categoryIconBoxActive: {
        backgroundColor: "#F0FDF4",
        borderColor: "#86EFAC",
        borderWidth: 1.5,
    },
    categoryImg: {
        width: "100%",
        height: "100%",
    },
    categoryLabel: {
        fontSize: 12,
        fontWeight: "700",
        color: "#475569",
    },
    categoryLabelActive: {
        color: "#16A34A",
        fontWeight: "800",
    },

    // 4. Popular picks
    popularHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.lg,
        marginTop: 22,
        marginBottom: 14,
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
