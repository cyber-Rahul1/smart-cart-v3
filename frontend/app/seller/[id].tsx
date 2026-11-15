import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
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
import { AppImage, ErrorState, Ionicons, Loader, Stepper, useToast, VegMark } from "@/src/ui";
import { navigateToTab } from "@/src/context/tab-bar-visibility";

type ModeItem = { id: string; product_id: string; qty: number; user_id: string; flat?: string };

const HERO_HEIGHT = 260;
const ESTIMATED_CARD_HEIGHT = 200;

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
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);
  const [measuredCardHeight, setMeasuredCardHeight] = useState(ESTIMATED_CARD_HEIGHT);
  const sectionListRef = useRef<any>(null);
  const bannerScrollRef = useRef<any>(null);
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
    return (cart.data?.items ?? []).filter((i: any) => i.seller_id === id || (!i.seller_id && cart.data?.seller?.id === id));
  }, [mode, group.data, basket.data, cart.data, id, user?.id]);

  const qtyOf = (pid: string) => myItems.filter((i) => i.product_id === pid).reduce((a, i) => a + i.qty, 0);
  const totalQty = myItems.reduce((a, i) => a + i.qty, 0);

  // Cart total price for floating pill
  const cartTotalAmount = useMemo(() => {
    if (mode === "cart") {
      const serverTotal = cart.data?.bill?.total ?? cart.data?.total_price;
      if (typeof serverTotal === "number" && serverTotal > 0) return serverTotal;
    }
    if (!q.data?.products) return 0;
    return myItems.reduce((sum, item) => {
      const prod = q.data!.products.find((p) => p.id === item.product_id);
      return sum + (prod ? prod.price * item.qty : 0);
    }, 0);
  }, [mode, cart.data, myItems, q.data?.products]);

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

  // The bottom edge of the hero image is at HERO_HEIGHT (260).
  const cardHeight = Math.max(160, measuredCardHeight);
  const initialCardTop = HERO_HEIGHT - 65; // Overlaps bottom of hero by 65px
  // The below section begins under the vertical center point of the title card
  const belowSectionStartTop = initialCardTop + cardHeight / 2;
  const paddingForCoveredHalfCard = cardHeight / 2 + 10;
  const dockTargetTop = 0; // Dock flush to the very top edge of the screen
  const maxScroll = Math.max(1, initialCardTop - dockTargetTop);

  // Smooth docking animation driven directly on the UI thread via transform translateY
  const cardAnimStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    const progress = Math.min(1, Math.max(0, y / maxScroll));

    const translateY = -Math.min(y, maxScroll);
    const left = interpolate(progress, [0, 1], [spacing.lg, 0]);
    const right = interpolate(progress, [0, 1], [spacing.lg, 0]);

    // Border radius transitions to 0 on top when docked flush to top screen edge
    const borderTopLeftRadius = interpolate(progress, [0, 1], [24, 0]);
    const borderTopRightRadius = interpolate(progress, [0, 1], [24, 0]);
    const borderBottomLeftRadius = interpolate(progress, [0, 1], [24, 16]);
    const borderBottomRightRadius = interpolate(progress, [0, 1], [24, 16]);

    // Animate top padding to respect status bar insets as it docks to screen edge
    const paddingTop = interpolate(progress, [0, 1], [14, insets.top + 10]);

    return {
      transform: [{ translateY }],
      left,
      right,
      borderTopLeftRadius,
      borderTopRightRadius,
      borderBottomLeftRadius,
      borderBottomRightRadius,
      paddingTop,
    };
  });

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

  const cardTitleAnimStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    const progress = Math.min(1, Math.max(0, y / maxScroll));
    const paddingLeft = interpolate(progress, [0.75, 1], [0, 32]);
    return {
      paddingLeft,
    };
  });

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

  // Collect hero carousel images
  const bannerImages = [
    seller.image,
    ...(seller.gallery && seller.gallery.length > 0 ? seller.gallery : []),
    seller.banner_url,
  ].filter(Boolean) as string[];
  const heroList = Array.from(new Set(bannerImages)).slice(0, 5);

  // Group products into 3-column rows
  const rawCategories = Array.from(new Set(products.map((p) => p.category)));
  const categoryList = ["all", ...rawCategories];

  // Helper to chunk products into rows of 3 items
  const chunkRows = (arr: Product[]) => {
    const rows: Product[][] = [];
    for (let i = 0; i < arr.length; i += 3) {
      rows.push(arr.slice(i, i + 3));
    }
    return rows;
  };

  // Grouped sections for SectionList
  const filteredProducts = selectedCategory === "all"
    ? products
    : products.filter((p) => p.category === selectedCategory);

  const rawSections = Object.entries(
    filteredProducts.reduce<Record<string, Product[]>>((acc, p) => {
      (acc[p.category] ??= []).push(p);
      return acc;
    }, {})
  ).map(([title, data]) => ({
    title,
    data: collapsedSections[title] ? [] : chunkRows(data),
    totalCount: data.length,
  }));

  const modeLabel = mode === "group" ? `Adding to shared cart: ${group.data?.name ?? ""}` : mode === "basket" ? `Adding to Flat ${basket.data?.my_flat ?? ""} · ${basket.data?.title ?? ""}` : null;
  const discountRemaining = Math.max(0, 299 - cartTotalAmount);

  return (
    <View style={s.root}>
      {/* 1. FIXED BACKGROUND HERO CAROUSEL */}
      <View style={s.fixedHeroContainer}>
        <Animated.View style={[StyleSheet.absoluteFill, bgImageAnimStyle]}>
          <ScrollView
            ref={bannerScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const x = e.nativeEvent.contentOffset.x;
              const w = Dimensions.get("window").width;
              if (w > 0) setActiveBannerIdx(Math.round(x / w));
            }}
          >
            {heroList.map((imgUri, idx) => (
              <View key={idx} style={{ width: Dimensions.get("window").width, height: HERO_HEIGHT }}>
                <AppImage
                  source={{ uri: mediaUri(imgUri) }}
                  fallbackType={seller.category === "grocery" ? "groceries" : "shop"}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={200}
                />
              </View>
            ))}
          </ScrollView>
        </Animated.View>
        <View style={s.heroDarkGradient} />

        {/* Carousel Page indicator (e.g., 1/5 ••••) on bottom right */}
        {heroList.length > 1 && (
          <View style={s.heroDotsBadge} pointerEvents="none">
            <Text style={s.heroDotsText}>{activeBannerIdx + 1}/{heroList.length}</Text>
            <View style={s.heroDotsList}>
              {heroList.map((_, i) => (
                <View
                  key={i}
                  style={[
                    s.heroDot,
                    i === activeBannerIdx ? s.heroDotActive : s.heroDotInactive,
                  ]}
                />
              ))}
            </View>
          </View>
        )}
      </View>

      {/* 2. FLOATING FIXED TOP CONTROLS: Back button on left, Share button on right (No heart icon) */}
      <Animated.View style={[s.fixedBackButtonWrapper, { top: insets.top + spacing.xs }, floatingBackBtnAnimStyle]}>
        <Pressable
          testID="seller-back-button"
          onPress={() => router.back()}
          style={s.topCircleBtn}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </Pressable>
      </Animated.View>

      <Animated.View style={[s.fixedShareButtonWrapper, { top: insets.top + spacing.xs }, floatingBackBtnAnimStyle]}>
        <Pressable
          testID="seller-share-button"
          onPress={() => toast("Shop link copied")}
          style={s.topCircleBtn}
          hitSlop={8}
        >
          <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
        </Pressable>
      </Animated.View>

      {/* 3. SCROLLABLE MENU & SECTIONS */}
      <SectionList
        ref={sectionListRef}
        testID="seller-menu-list"
        style={s.sectionList}
        sections={rawSections}
        keyExtractor={(_, index) => `row-${index}`}
        stickySectionHeadersEnabled={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        ListHeaderComponent={
          <View>
            {/* Transparent spacer so the below section begins at the vertical center of the card */}
            <View style={{ height: belowSectionStartTop }} />

            {/* Solid background container for entire menu section below the title card */}
            <View style={[s.menuContentContainer, { paddingTop: paddingForCoveredHalfCard }]}>
              {/* Flat Promo Offer Banner Pill */}
              <View style={{ paddingHorizontal: 16 }}>
                <Pressable
                  testID="seller-offer-banner"
                  onPress={() => toast(seller.offer || "Flat ₹30 OFF applied on checkout")}
                  style={s.promoOfferBanner}
                >
                  <View style={s.promoOfferLeft}>
                    <View style={s.promoIconBox}>
                      <Ionicons name="pricetag" size={15} color="#EA580C" />
                    </View>
                    <Text style={s.promoOfferText}>
                      {seller.offer || "Flat ₹30 OFF on orders above ₹299"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#EA580C" />
                </Pressable>
              </View>

              {/* Category Filter Chips Horizontal Row */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.categoryChipsScroll}
                style={{ marginTop: 12, marginBottom: 4 }}
              >
                {categoryList.map((catKey) => {
                  const isActive = selectedCategory === catKey;
                  const label = catKey === "all" ? "All Items" : catKey;
                  const iconName = catKey === "all"
                    ? "list-outline"
                    : catKey.toLowerCase().includes("bake")
                    ? "nutrition-outline"
                    : catKey.toLowerCase().includes("dairy")
                    ? "water-outline"
                    : catKey.toLowerCase().includes("egg")
                    ? "egg-outline"
                    : "cafe-outline";

                  return (
                    <Pressable
                      key={catKey}
                      onPress={() => setSelectedCategory(catKey)}
                      style={[
                        s.categoryChip,
                        isActive && s.categoryChipActive,
                      ]}
                    >
                      <Ionicons
                        name={iconName as any}
                        size={15}
                        color={isActive ? "#FFFFFF" : "#374151"}
                      />
                      <Text style={[s.categoryChipText, isActive && s.categoryChipTextActive]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => {
          const isCollapsed = !!collapsedSections[section.title];
          return (
            <Pressable
              testID={`section-toggle-${section.title}`}
              style={s.sectionHeaderRow}
              onPress={() => toggleSection(section.title)}
            >
              <Text style={s.sectionTitleText}>
                {section.title} ({section.totalCount})
              </Text>
              {/* Dropdown arrow icon instead of View All */}
              <View style={s.dropdownArrowBox}>
                <Ionicons
                  name={isCollapsed ? "chevron-down" : "chevron-up"}
                  size={18}
                  color={colors.brandPrimary}
                />
              </View>
            </Pressable>
          );
        }}
        renderItem={({ item: rowProducts }) => (
          <View style={{ backgroundColor: "#FDFBF9" }}>
            <View style={s.gridRow}>
              {rowProducts.map((p) => {
                const qty = qtyOf(p.id);
                const isBusy = busy === p.id;
                return (
                  <View key={p.id} style={s.gridCard} testID={`product-${p.id}`}>
                    {/* Product Image Box */}
                    <View style={s.gridCardImageBox}>
                      <AppImage
                        source={{ uri: mediaUri(p.image) }}
                        fallbackType={seller.category === "grocery" ? "groceries" : "food"}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        transition={150}
                      />

                      {/* Square Veg Mark indicator at bottom-left of image */}
                      <View style={s.gridCardVegBox}>
                        <VegMark veg={p.veg} />
                      </View>
                    </View>

                    {/* Title & Price & Add/Stepper */}
                    <View style={s.gridCardContent}>
                      <Text style={s.gridCardTitle} numberOfLines={2}>
                        {p.name}
                      </Text>
                      <Text style={s.gridCardPrice}>{rupee(p.price)}</Text>

                      {/* Action button: '+ Add' pill or Stepper */}
                      <View style={s.gridCardActionRow}>
                        {qty === 0 ? (
                          <Pressable
                            testID={`product-add-${p.id}`}
                            disabled={!p.available || isBusy}
                            onPress={() => change(p, 1)}
                            style={({ pressed }) => [
                              s.gridAddBtn,
                              pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
                              (!p.available || isBusy) && { opacity: 0.4 },
                            ]}
                          >
                            <Ionicons name="add" size={14} color={colors.brandPrimary} />
                            <Text style={s.gridAddBtnText}>Add</Text>
                          </Pressable>
                        ) : (
                          <View style={s.stepperWrapper}>
                            <Stepper
                              testID={`product-stepper-${p.id}`}
                              qty={qty}
                              disabled={!p.available || isBusy}
                              onChange={(n) => change(p, n)}
                            />
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
              {/* Fillers for incomplete 3-column rows */}
              {rowProducts.length === 1 && (
                <>
                  <View style={[s.gridCard, { opacity: 0 }]} />
                  <View style={[s.gridCard, { opacity: 0 }]} />
                </>
              )}
              {rowProducts.length === 2 && (
                <View style={[s.gridCard, { opacity: 0 }]} />
              )}
            </View>
          </View>
        )}
      />

      {/* 4. DOCKED / FLOATING CARD MATCHING FIRST IMAGE */}
      <Animated.View
        style={[s.floatingCard, { top: initialCardTop }, cardAnimStyle]}
        pointerEvents="box-none"
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 50 && Math.abs(h - measuredCardHeight) > 2) {
            setMeasuredCardHeight(h);
          }
        }}
      >
        <View style={s.cardBodyRow}>
          {/* Shop Logo Avatar Box */}
          <View style={s.shopLogoBox}>
            {seller.image ? (
              <AppImage
                source={{ uri: mediaUri(seller.image) }}
                fallbackType={seller.category === "grocery" ? "groceries" : "shop"}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : (
              <Ionicons
                name={seller.category === "grocery" ? "basket" : "restaurant"}
                size={26}
                color="#FFFFFF"
              />
            )}
          </View>

          {/* Center Shop Details */}
          <View style={s.shopInfoCol}>
            <View style={s.cardTitleRow}>
              {/* Back button when docked */}
              <Animated.View style={[s.cardBackBtnWrapper, cardBackBtnAnimStyle]}>
                <Pressable
                  testID="seller-docked-back-button"
                  onPress={() => router.back()}
                  style={s.cardBackBtn}
                  hitSlop={8}
                >
                  <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
                </Pressable>
              </Animated.View>
              <Animated.Text testID="seller-name" style={[s.shopNameTitle, cardTitleAnimStyle]} numberOfLines={1}>
                {seller.name}
              </Animated.Text>
              <Ionicons name="checkmark-circle" size={17} color="#22C55E" style={{ marginLeft: 4 }} />
            </View>

            {/* Subtitle: Cuisine / Category & Area */}
            <Text style={s.shopSubtitleText} numberOfLines={1}>
              {seller.cuisine ? seller.cuisine.replace(/,/g, ", ") : (seller.category === "grocery" ? "Grocery, Staples" : "South Indian, Meals")} • {seller.address || "Koramangala, Bengaluru"}
            </Text>

            {/* Rating Pill & Reviews */}
            <View style={s.shopRatingRow}>
              <View style={s.ratingBadgeGreen}>
                <Ionicons name="star" size={11} color="#FFFFFF" />
                <Text style={s.ratingBadgeText}>{seller.rating ? seller.rating.toFixed(1) : "4.4"}</Text>
              </View>
              <Text style={s.reviewsCountText}>
                ({seller.reviews_count ? `${(seller.reviews_count / 1000).toFixed(1)}k` : "2.8k"} reviews)
              </Text>
            </View>

            {/* Metrics: ETA | Distance | Prep time */}
            <View style={s.shopMetricsRow}>
              <View style={s.metricItem}>
                <Ionicons name="time-outline" size={14} color="#64748B" />
                <Text style={s.metricItemText}>{seller.eta_min || 17} mins</Text>
              </View>
              <View style={s.metricItemDivider} />
              <View style={s.metricItem}>
                <Ionicons name="location-outline" size={14} color="#64748B" />
                <Text style={s.metricItemText}>{seller.distance_km || 0.7} km</Text>
              </View>
              <View style={s.metricItemDivider} />
              <View style={s.metricItem}>
                <Ionicons name="restaurant-outline" size={14} color="#64748B" />
                <Text style={s.metricItemText}>Prep {seller.prep_time_min || 15} mins</Text>
              </View>
            </View>

            {/* Min order */}
            <Text style={s.minOrderText}>Min order: {rupee(seller.min_order || 49)}</Text>
          </View>
        </View>

        {modeLabel ? (
          <View testID="seller-mode-banner" style={s.mode}>
            <Ionicons name={mode === "group" ? "people" : "business"} size={16} color={colors.onPastelLilac} />
            <Text style={s.modeText}>{modeLabel}</Text>
          </View>
        ) : null}
      </Animated.View>

      {/* 5. FLOATING BOTTOM CART BAR MATCHING THIRD IMAGE (USING APP'S THEME) */}
      {totalQty > 0 ? (
        <View style={[s.cartBarContainer, { bottom: insets.bottom + 12 }]}>
          <Pressable
            testID="seller-view-cart-bar"
            style={s.cartBarInner}
            onPress={() => {
              if (mode === "cart") {
                navigateToTab(2);
                router.back();
              } else {
                router.back();
              }
            }}
          >
            {/* Left: Cart Icon with Badge */}
            <View style={s.cartIconWithBadge}>
              <Ionicons name="cart" size={24} color="#FFFFFF" />
              <View style={s.cartCountBadge}>
                <Text style={s.cartCountBadgeText}>{totalQty}</Text>
              </View>
            </View>

            {/* Vertical Divider */}
            <View style={s.cartBarDivider} />

            {/* Middle: Items & Total Price & Discount Prompt */}
            <View style={s.cartBarMiddle}>
              <Text style={s.cartBarMainText}>
                {totalQty} item{totalQty > 1 ? "s" : ""} • {rupee(cartTotalAmount)}
              </Text>
              <Text style={s.cartBarSubText}>
                {discountRemaining > 0
                  ? `Add ${rupee(discountRemaining)} more for ₹30 OFF`
                  : "₹30 OFF unlocked on your bill!"}
              </Text>
            </View>

            {/* Right: View Cart Button Pill */}
            <View style={s.viewCartPill}>
              <Text style={s.viewCartPillText}>View Cart</Text>
              <Ionicons name="arrow-forward" size={14} color="#16A34A" />
            </View>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: "#FDFBF9" },

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
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  heroDotsBadge: {
    position: "absolute",
    bottom: 24,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 12,
  },
  heroDotsText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  heroDotsList: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  heroDot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.5,
  },
  heroDotActive: {
    backgroundColor: "#FFFFFF",
  },
  heroDotInactive: {
    backgroundColor: "rgba(255,255,255,0.45)",
  },

  /* Fixed Top Buttons */
  fixedBackButtonWrapper: {
    position: "absolute",
    left: 16,
    zIndex: 50,
  },
  fixedShareButtonWrapper: {
    position: "absolute",
    right: 16,
    zIndex: 50,
  },
  topCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
  },

  /* SectionList */
  sectionList: {
    flex: 1,
    zIndex: 10,
    backgroundColor: "transparent",
  },
  menuContentContainer: {
    backgroundColor: "#FDFBF9",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    marginTop: -8,
  },

  /* Floating Docked Card */
  floatingCard: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingBottom: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 30,
    elevation: 6,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  cardBodyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  shopLogoBox: {
    width: 68,
    height: 68,
    borderRadius: 12,
    backgroundColor: "#166534",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  shopInfoCol: {
    flex: 1,
    marginLeft: 12,
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
  shopNameTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  shopSubtitleText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 2,
  },
  shopRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 5,
  },
  ratingBadgeGreen: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#16A34A",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratingBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  reviewsCountText: {
    fontSize: 11.5,
    fontWeight: "500",
    color: "#64748B",
  },
  shopMetricsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 7,
  },
  metricItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metricItemText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#334155",
  },
  metricItemDivider: {
    width: 1,
    height: 10,
    backgroundColor: "#CBD5E1",
    marginHorizontal: 1,
  },
  minOrderText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 5,
  },
  mode: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    backgroundColor: c.pastelLilac,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginTop: 8,
  },
  modeText: {
    color: c.onPastelLilac,
    fontWeight: "700",
    flex: 1,
    fontSize: font.sm + 1,
  },

  /* Promo Offer Banner */
  promoOfferBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FFEDD5",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  promoOfferLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  promoIconBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFEDD5",
    alignItems: "center",
    justifyContent: "center",
  },
  promoOfferText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#C2410C",
    flex: 1,
  },

  /* Category Filter Chips */
  categoryChipsScroll: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: "center",
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  categoryChipActive: {
    backgroundColor: c.brandPrimary,
    borderColor: c.brandPrimary,
  },
  categoryChipText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#334155",
  },
  categoryChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  /* Section Header */
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: "#FDFBF9",
  },
  sectionTitleText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  dropdownArrowBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },

  /* 3-Column Grid Cards */
  gridRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    gap: 8,
    marginTop: 0,
    marginBottom: 12,
  },
  gridCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1.5,
  },
  gridCardImageBox: {
    width: "100%",
    height: 105,
    backgroundColor: c.surfaceTertiary,
    position: "relative",
  },
  gridCardVegBox: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 4,
    padding: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  gridCardContent: {
    padding: 8,
    justifyContent: "space-between",
    minHeight: 88,
  },
  gridCardTitle: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#1E293B",
    lineHeight: 15,
  },
  gridCardPrice: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 4,
  },
  gridCardActionRow: {
    marginTop: 6,
    alignItems: "flex-end",
  },
  gridAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    backgroundColor: c.brandTertiary,
    borderWidth: 1,
    borderColor: "#FED7AA",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4.5,
  },
  gridAddBtnText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: c.brandPrimary,
  },
  stepperWrapper: {
    transform: [{ scale: 0.85 }],
    marginRight: -6,
  },

  /* Floating Bottom Cart Bar (Image 3 layout in our Theme) */
  cartBarContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 999,
    elevation: 20,
  },
  cartBarInner: {
    height: 60,
    borderRadius: 12,
    backgroundColor: "#16A34A",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    shadowColor: "#16A34A",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  cartIconWithBadge: {
    position: "relative",
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  cartCountBadge: {
    position: "absolute",
    top: -4,
    right: -6,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  cartCountBadgeText: {
    color: "#16A34A",
    fontSize: 10.5,
    fontWeight: "900",
  },
  cartBarDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    marginHorizontal: 12,
  },
  cartBarMiddle: {
    flex: 1,
  },
  cartBarMainText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: -0.2,
  },
  cartBarSubText: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 10.5,
    fontWeight: "600",
    marginTop: 1,
  },
  viewCartPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 7,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  viewCartPillText: {
    color: "#16A34A",
    fontWeight: "800",
    fontSize: 12,
  },
}));
