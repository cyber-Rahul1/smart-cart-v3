import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedScrollHandler,
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
import ProductDetailModal from "@/src/components/product-detail-modal";
import { applyOptimisticCartItem } from "@/src/cart";
import { TextInput } from "react-native";

type ModeItem = { id: string; product_id: string; qty: number; user_id: string; flat?: string };

const HERO_HEIGHT = 400;
const ESTIMATED_CARD_HEIGHT = 185;

const AnimatedSectionList = Animated.createAnimatedComponent<any>(SectionList);

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
  const [menuSearchQuery, setMenuSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
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
    let rollback: (() => void) | null = null;
    if (mode === "cart") {
      rollback = applyOptimisticCartItem(p, next, q.data?.seller);
    } else {
      setBusy(p.id);
    }
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
      if (rollback) rollback();
      if (e instanceof ApiError && e.status === 409 && mode === "cart") setConflict({ product_id: p.id, qty: next });
      else toast((e as Error).message, "err");
    } finally {
      if (mode !== "cart") setBusy(null);
    }
  };

  // The hero background extends behind the card down to HERO_HEIGHT (400)
  // The card is positioned overlapping the lower part of the hero image, leaving a snug ~10-12px of the rounded hero image visible below it
  const cardHeight = Math.max(160, measuredCardHeight);
  const bottomImageMargin = 10; // Tight, snug margin below the resizable card
  const initialCardTop = HERO_HEIGHT - cardHeight - bottomImageMargin;
  // The below section (filter bar & items) begins cleanly below the rounded hero container
  const belowSectionStartTop = HERO_HEIGHT + 12;
  const dockTargetTop = insets.top; // Dock gracefully at top safe area
  const maxScroll = Math.max(1, initialCardTop - dockTargetTop);

  // Smooth GPU-accelerated docking animation driven on the UI thread
  const cardAnimStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    const progress = Math.min(1, Math.max(0, y / maxScroll));
    const translateY = -Math.min(y, maxScroll);

    // Expand width to full screen width as it docks: horizontal margin decreases from 16 to 0
    const marginHorizontal = interpolate(progress, [0, 1], [0, -spacing.lg], Extrapolate.CLAMP);

    // Smoothly flatten top corners when flush with the top
    const borderTopLeftRadius = interpolate(progress, [0.6, 1], [22, 0], Extrapolate.CLAMP);
    const borderTopRightRadius = interpolate(progress, [0.6, 1], [22, 0], Extrapolate.CLAMP);
    const borderBottomLeftRadius = interpolate(progress, [0.6, 1], [22, 20], Extrapolate.CLAMP);
    const borderBottomRightRadius = interpolate(progress, [0.6, 1], [22, 20], Extrapolate.CLAMP);

    const paddingTop = interpolate(progress, [0, 1], [14, insets.top + 8], Extrapolate.CLAMP);
    const paddingHorizontal = interpolate(progress, [0, 1], [14, 16], Extrapolate.CLAMP);

    return {
      transform: [{ translateY }],
      marginHorizontal,
      borderTopLeftRadius,
      borderTopRightRadius,
      borderBottomLeftRadius,
      borderBottomRightRadius,
      paddingTop,
      paddingHorizontal,
    };
  });

  const floatingBackBtnAnimStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    const progress = Math.min(1, Math.max(0, y / maxScroll));
    const opacity = interpolate(progress, [0.4, 0.8], [1, 0], Extrapolate.CLAMP);
    const scale = interpolate(progress, [0.4, 0.8], [1, 0.8], Extrapolate.CLAMP);
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  const cardBackBtnAnimStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    const progress = Math.min(1, Math.max(0, y / maxScroll));
    const opacity = interpolate(progress, [0.7, 1], [0, 1], Extrapolate.CLAMP);
    const translateX = interpolate(progress, [0.7, 1], [-12, 0], Extrapolate.CLAMP);
    return {
      opacity,
      transform: [{ translateX }],
    };
  });

  const cardTitleAnimStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    const progress = Math.min(1, Math.max(0, y / maxScroll));
    const paddingLeft = interpolate(progress, [0.7, 1], [0, 32], Extrapolate.CLAMP);
    return {
      paddingLeft,
    };
  });

  const bgImageAnimStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    const translateY = -y;
    const scale = y < 0 ? 1 + Math.abs(y) / HERO_HEIGHT : 1;
    return {
      transform: [{ translateY }, { scale }],
    };
  });

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const allProducts = q.data?.products ?? [];

  // Grouped sections for SectionList
  const filteredProducts = useMemo(() => {
    let list = allProducts;
    if (selectedCategory !== "all") {
      list = list.filter((p) => p.category === selectedCategory);
    }
    if (menuSearchQuery.trim()) {
      const query = menuSearchQuery.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query) ||
          (p.description && p.description.toLowerCase().includes(query))
      );
    }
    return list;
  }, [allProducts, selectedCategory, menuSearchQuery]);

  if (q.isLoading) return <Loader />;
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  const { seller, products } = q.data!;

  // Collect store banner & showcase images strictly for the store carousel
  // Only genuine seller banner/gallery images are shown (not random product images)
  const bannerImages = [
    seller.image,
    ...(seller.gallery && seller.gallery.length > 0 ? seller.gallery : []),
    seller.banner_url,
  ].filter(Boolean) as string[];
  const heroList = Array.from(new Set(bannerImages)).slice(0, 6);

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
      {/* Background Graphic matching Home and Listing pages */}
      <Image
        source={require("@/assets/images/gathr_home_bg.jpg")}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        priority="high"
      />

      {/* 1. SCROLLABLE STORE HERO CAROUSEL */}
      <Animated.View style={[s.fixedHeroContainer, bgImageAnimStyle]}>
        <View style={StyleSheet.absoluteFill}>
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
        </View>
        {/* Gradient shadow overlay on bottom of hero image behind the resizable card */}
        <LinearGradient
          colors={["transparent", "rgba(51, 65, 85, 0.40)", "rgba(15, 23, 42, 0.75)"]}
          locations={[0, 0.65, 1]}
          style={s.heroBottomGradient}
          pointerEvents="none"
        />

        {/* Carousel Page indicator (e.g., 2/6 with photo icon) brought close right above the resizable card */}
        {heroList.length > 1 && (
          <View style={[s.heroDotsBadge, { top: Math.max(70, initialCardTop - 34) }]} pointerEvents="none">
            <Ionicons name="images-outline" size={13} color="#0F172A" />
            <Text style={s.heroDotsText}>{activeBannerIdx + 1}/{heroList.length}</Text>
          </View>
        )}
      </Animated.View>

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
      <AnimatedSectionList
        ref={sectionListRef}
        testID="seller-menu-list"
        style={s.sectionList}
        sections={rawSections}
        keyExtractor={(_: any, index: number) => `row-${index}`}
        stickySectionHeadersEnabled={false}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        removeClippedSubviews={Platform.OS === "android"}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        ListHeaderComponent={
          <View>
            {/* Transparent spacer so the below section begins right below the title card */}
            <View style={{ height: belowSectionStartTop }} />

            {/* Menu section container below the title card */}
            <View style={s.menuContentContainer}>
              {/* Filter capsule bar matching reference UI (enclosed pill with internal scroll) */}
              <View style={s.filterCapsuleContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.filterCapsuleScroll}
                >
                  {categoryList.map((catKey) => {
                    const isActive = selectedCategory === catKey;
                    const label = catKey === "all" ? "All Items" : catKey;

                    return (
                      <Pressable
                        key={catKey}
                        onPress={() => setSelectedCategory(catKey)}
                        style={[
                          s.filterCapsuleTab,
                          isActive && s.filterCapsuleTabActive,
                        ]}
                      >
                        <Text style={[s.filterCapsuleTabText, isActive && s.filterCapsuleTabTextActive]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </View>
        }
        renderSectionHeader={({ section }: any) => {
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
        renderItem={({ item: rowProducts }: any) => (
          <View style={{ backgroundColor: "transparent" }}>
            <View style={s.gridRow}>
              {rowProducts.map((p: Product) => {
                const qty = qtyOf(p.id);
                const isBusy = busy === p.id;
                return (
                  <Pressable
                    key={p.id}
                    style={s.gridCard}
                    testID={`product-${p.id}`}
                    onPress={() => setSelectedProduct(p)}
                  >
                    {/* Glassmorphic backdrop blur & themed translucent liquid rose gradient */}
                    <BlurView intensity={Platform.OS === "ios" ? 18 : 8} tint="light" style={StyleSheet.absoluteFill} />
                    <LinearGradient
                      colors={["rgba(255, 245, 248, 0.75)", "rgba(255, 230, 238, 0.52)"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                    />

                    {/* Specular glass reflection along top edge */}
                    <View
                      pointerEvents="none"
                      style={s.cardGlassHighlight}
                    />

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

                    {/* Title & Price & Add/Stepper (Compact height) */}
                    <View style={s.gridCardContent}>
                      <View>
                        <Text style={s.gridCardTitle} numberOfLines={2}>
                          {p.name}
                        </Text>
                        <Text style={s.gridCardPrice}>{rupee(p.price)}</Text>
                      </View>

                      {/* Action button: '+ Add' pill or Stepper */}
                      <View style={s.gridCardActionRow}>
                        {qty === 0 ? (
                          <Pressable
                            testID={`product-add-${p.id}`}
                            disabled={!p.available || isBusy}
                            onPress={(e) => {
                              e.stopPropagation();
                              change(p, 1);
                            }}
                            style={({ pressed }) => [
                              s.gridAddBtn,
                              pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
                              (!p.available || isBusy) && { opacity: 0.4 },
                            ]}
                          >
                            <Ionicons name="add" size={13} color={colors.brandPrimary} />
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
                  </Pressable>
                );
              })}
              {/* Fillers for incomplete 3-column rows */}
              {rowProducts.length === 1 && (
                <>
                  <View style={{ flex: 1 }} />
                  <View style={{ flex: 1 }} />
                </>
              )}
              {rowProducts.length === 2 && (
                <View style={{ flex: 1 }} />
              )}
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={s.storeFooterContainer}>
            {/* Disclaimer Box */}
            <View style={s.disclaimerSection}>
              <Text style={s.disclaimerHeading}>Disclaimer :</Text>
              <View style={s.bulletItem}>
                <View style={s.bulletDot} />
                <Text style={s.bulletText}>
                  All prices, discounts, and item availability are set directly by the merchant.
                </Text>
              </View>
              <View style={s.bulletItem}>
                <View style={s.bulletDot} />
                <Text style={s.bulletText}>
                  Nutritional and allergen information is indicative, supplied by the merchant, and may vary depending on ingredients and preparation.
                </Text>
              </View>
              <View style={s.bulletItem}>
                <View style={s.bulletDot} />
                <Text style={s.bulletText}>
                  An average active adult requires 2,000 kcal energy per day; however, individual calorie needs may vary.
                </Text>
              </View>
              <View style={s.bulletItem}>
                <View style={s.bulletDot} />
                <Text style={s.bulletText}>
                  Product descriptions and imagery may be enhanced by SmartCart AI for a better shopping experience.
                </Text>
              </View>
            </View>

            {/* Report an issue with the menu / store */}
            <Pressable
              style={({ pressed }) => [s.reportIssueRow, pressed && { opacity: 0.75 }]}
              onPress={() => toast("Feedback recorded. Our support team will review this menu.")}
            >
              <View style={s.reportIssueLeft}>
                <Ionicons name="alert-circle-outline" size={17} color="#475569" />
                <Text style={s.reportIssueText}>Report an issue with the menu or pricing</Text>
              </View>
              <Ionicons name="play" size={11} color="#64748B" />
            </Pressable>

            {/* License / Registration details (if available, otherwise fallback) */}
            <View style={s.licenseSection}>
              {seller.fssai_number ? (
                <View style={s.licenseRow}>
                  <Text style={s.licenseLabel}>
                    {seller.category === "food" ? "FSSAI License No." : "Registration No."}
                  </Text>
                  <Text style={s.licenseValue}>{seller.fssai_number}</Text>
                </View>
              ) : seller.registration_no ? (
                <View style={s.licenseRow}>
                  <Text style={s.licenseLabel}>Registration No.</Text>
                  <Text style={s.licenseValue}>{seller.registration_no}</Text>
                </View>
              ) : (
                <View style={s.licenseRow}>
                  <Text style={s.licenseLabel}>Merchant Verification</Text>
                  <Text style={s.licenseValueMuted}>
                    {seller.fssai_status === "verified"
                      ? "Verified Partner Store"
                      : "Registered Merchant on SmartCart"}
                  </Text>
                </View>
              )}
            </View>

            {/* Store Title & Address Section */}
            <View style={s.storeIdentitySection}>
              <Text style={s.footerStoreName}>{seller.name}</Text>
              {seller.cuisine ? (
                <Text style={s.footerOutletSub}>
                  (Specialty : {seller.cuisine})
                </Text>
              ) : null}

              <View style={s.addressRow}>
                <Ionicons name="location-outline" size={16} color="#475569" style={{ marginTop: 2 }} />
                <Text style={s.addressText}>
                  {seller.address && seller.address.trim()
                    ? seller.address
                    : "Registered store location available upon order fulfillment."}
                </Text>
              </View>
            </View>
          </View>
        }
      />

      {/* 4. DOCKED / FLOATING CARD MATCHING FIRST IMAGE */}
      <Animated.View
        style={[s.floatingCard, { top: initialCardTop }, cardAnimStyle]}
        pointerEvents="box-none"
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && Math.abs(h - measuredCardHeight) > 2) {
            setMeasuredCardHeight(h);
          }
        }}
      >
        <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={["rgba(255, 255, 255, 0.94)", "rgba(255, 245, 247, 0.88)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Specular top highlight */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: "rgba(255, 255, 255, 0.95)",
          }}
        />
        <View style={s.cardBodyRow}>
          {/* Shop Details arranged exactly matching reference image */}
          <View style={s.shopInfoCol}>
            {/* Row 1: Title (left) & Rating Badge (right) */}
            <View style={s.cardHeaderRow}>
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
              </View>

              {/* Rating badge on right side */}
              <View style={s.ratingBadgeRightCol}>
                <View style={s.ratingBadgeGreen}>
                  <Text style={s.ratingBadgeText}>{seller.rating ? seller.rating.toFixed(1) : "4.4"}</Text>
                  <Ionicons name="star" size={11} color="#FFFFFF" />
                </View>
                <Text style={s.reviewsCountText}>
                  {seller.reviews_count ? `${(seller.reviews_count / 1000).toFixed(1)}k ratings` : "819 ratings"}
                </Text>
              </View>
            </View>

            {/* Row 2: Distance & Area with dropdown chevron */}
            <View style={s.distanceLocationRow}>
              <Text style={s.distanceLocationText} numberOfLines={1}>
                {seller.distance_km || 0.7} km · {seller.address || "Siripuram, Vizag"}
              </Text>
              <Ionicons name="caret-down" size={13} color="#0D9488" style={{ marginLeft: 3 }} />
            </View>

            {/* Row 3: Cuisine & Min order / price for two */}
            <Text style={s.shopSubtitleText} numberOfLines={1}>
              {seller.cuisine ? seller.cuisine.replace(/,/g, ", ") : (seller.category === "grocery" ? "Grocery, Staples" : "North Indian, Continental")} | {rupee(seller.min_order || 49)} min order
            </Text>

            {/* Row 4: Action pills (Open till 11PM, Directions, Call) themed with rose/pastel tones */}
            <View style={s.actionPillsRow}>
              <View style={s.openTillPill}>
                <Ionicons name="time-outline" size={13} color="#E11D48" style={{ marginRight: 4 }} />
                <Text style={s.openTillPillText}>
                  <Text style={{ color: "#E11D48", fontWeight: "800" }}>Open</Text> till 11PM
                </Text>
                <Ionicons name="chevron-down" size={13} color="#FB7185" style={{ marginLeft: 3 }} />
              </View>

              {/* Directions Icon Circle */}
              <Pressable
                onPress={() => toast("Opening directions...")}
                style={s.actionCircleBtn}
                hitSlop={6}
              >
                <Ionicons name="navigate-outline" size={15} color="#E11D48" />
              </Pressable>

              {/* Call Icon Circle */}
              <Pressable
                onPress={() => toast("Calling restaurant...")}
                style={s.actionCircleBtn}
                hitSlop={6}
              >
                <Ionicons name="call-outline" size={15} color="#E11D48" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Search Bar on Resizable Card matching theme with light glassmorphic background */}
        <View style={s.cardSearchBar}>
          <BlurView intensity={24} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={["rgba(255, 255, 255, 0.85)", "rgba(255, 240, 244, 0.60)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Subtle top specular glass highlight */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 14,
              right: 14,
              height: 1,
              backgroundColor: "rgba(255, 255, 255, 0.95)",
            }}
          />
          <Ionicons name="search" size={16} color="#F43F5E" />
          <TextInput
            value={menuSearchQuery}
            onChangeText={setMenuSearchQuery}
            placeholder={`Search in ${seller.name}...`}
            placeholderTextColor="#94A3B8"
            style={s.cardSearchInput}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {menuSearchQuery.length > 0 && (
            <Pressable onPress={() => setMenuSearchQuery("")} hitSlop={8} style={{ padding: 2 }}>
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </Pressable>
          )}
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
                router.push("/cart");
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

      {/* 6. ITEM DETAIL BOTTOM SHEET MODAL */}
      <ProductDetailModal
        visible={!!selectedProduct}
        product={selectedProduct}
        seller={seller}
        currentQty={selectedProduct ? qtyOf(selectedProduct.id) : 0}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={(p, qty, cookingRequest) => {
          change(p, qty);
          if (cookingRequest) {
            toast(`Note for chef: "${cookingRequest}"`);
          }
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: "#FFFFFF" },

  /* Fixed Hero Background */
  fixedHeroContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT,
    backgroundColor: c.surfaceTertiary,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",
    zIndex: 0,
  },
  heroBottomGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 180,
  },
  heroDotsBadge: {
    position: "absolute",
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
  },
  heroDotsText: {
    color: "#0F172A",
    fontSize: 11,
    fontWeight: "700",
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
    backgroundColor: "transparent",
    paddingTop: 8,
    marginTop: -8,
  },

  /* Floating Docked Card */
  floatingCard: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: "#FBF7EE", // Warm off-white surface matching reference image
    borderRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    zIndex: 30,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.95)",
    overflow: "hidden",
  },
  cardBodyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  shopInfoCol: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    flex: 1,
    marginRight: 8,
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
    fontSize: 21,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.4,
    flexShrink: 1,
  },
  ratingBadgeRightCol: {
    alignItems: "flex-end",
  },
  ratingBadgeGreen: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#0FA974", // Emerald green pill matching reference
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ratingBadgeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  reviewsCountText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 3,
    textDecorationLine: "underline",
    textDecorationStyle: "dotted",
  },
  distanceLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  distanceLocationText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  shopSubtitleText: {
    fontSize: 12.5,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 4,
  },
  actionPillsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  openTillPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF1F3",
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.16)",
  },
  openTillPillText: {
    fontSize: 11.5,
    color: "#881337",
    fontWeight: "600",
  },
  actionCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFF1F3",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.16)",
  },
  cardSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.70)",
    borderRadius: 22,
    paddingHorizontal: 12,
    height: 38,
    marginTop: 10,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(245, 129, 164, 0.14)", // Very light maroon/rose border
  },
  cardSearchInput: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "600",
    color: "#1E293B",
    marginLeft: 6,
    paddingVertical: 0,
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
    backgroundColor: "#FFF1F3",
    borderWidth: 1,
    borderColor: "#FECDD3",
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
    backgroundColor: "rgba(244, 63, 94, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  promoOfferText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#E11D48",
    flex: 1,
  },

  /* Filter Capsule Bar matching Reference UI & App Theme */
  filterCapsuleContainer: {
    marginHorizontal: 16,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.18)",
    backgroundColor: "rgba(255, 255, 255, 0.38)",
    overflow: "hidden",
    justifyContent: "center",
    shadowColor: "#F43F5E",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  filterCapsuleScroll: {
    paddingHorizontal: 3,
    alignItems: "center",
    gap: 3,
  },
  filterCapsuleTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  filterCapsuleTabActive: {
    backgroundColor: "#0B0F19", // Solid black active background
  },
  filterCapsuleTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  filterCapsuleTabTextActive: {
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
    backgroundColor: "transparent",
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
    backgroundColor: "#FFF1F3",
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
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 220, 230, 0.80)",
    shadowColor: "#F43F5E",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cardGlassHighlight: {
    position: "absolute",
    top: 0,
    left: 8,
    right: 8,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.65)",
    zIndex: 10,
  },
  gridCardImageBox: {
    width: "100%",
    height: 100,
    backgroundColor: "transparent",
    position: "relative",
  },
  gridCardVegBox: {
    position: "absolute",
    bottom: 5,
    left: 5,
    zIndex: 10,
  },
  gridCardContent: {
    paddingHorizontal: 7,
    paddingTop: 5,
    paddingBottom: 6,
    justifyContent: "space-between",
    minHeight: 66,
    backgroundColor: "transparent",
  },
  gridCardTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1E293B",
    lineHeight: 14,
    backgroundColor: "transparent",
  },
  gridCardPrice: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
    backgroundColor: "transparent",
  },
  gridCardActionRow: {
    marginTop: 4,
    alignItems: "flex-end",
  },
  gridAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2.5,
    backgroundColor: "#FFF1F3",
    borderWidth: 1,
    borderColor: "#FECDD3",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
  },
  gridAddBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#F43F5E",
  },
  stepperWrapper: {
    transform: [{ scale: 0.80 }],
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

  /* Store Footer: Disclaimer, License & Registered Address */
  storeFooterContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
    backgroundColor: "transparent",
  },
  disclaimerSection: {
    paddingBottom: 16,
  },
  disclaimerHeading: {
    fontSize: 14,
    fontWeight: "800",
    color: "#475569",
    marginBottom: 8,
  },
  bulletItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#94A3B8",
    marginTop: 6,
    marginRight: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: "#64748B",
    fontWeight: "500",
  },
  reportIssueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.8)",
    marginVertical: 12,
  },
  reportIssueLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reportIssueText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  licenseSection: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.8)",
  },
  licenseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  licenseLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  licenseValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: 0.3,
  },
  licenseValueMuted: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  storeIdentitySection: {
    paddingTop: 16,
    gap: 4,
  },
  footerStoreName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E293B",
  },
  footerOutletSub: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 6,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 2,
  },
  addressText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: "#64748B",
    fontWeight: "500",
  },
}));
