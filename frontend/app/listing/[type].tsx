import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError } from "@/src/api";
import { rupee, mediaUri } from "@/src/format";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Address, DiscoverResponse, Product, Seller, ShowcaseItem } from "@/src/types";
import { EmptyState, ErrorState, Header, IconName, Ionicons, Loader, useToast, VegMark } from "@/src/ui";

const TITLES: Record<string, [string, string]> = {
  food: ["Food", "Restaurants & cloud kitchens near you"],
  grocery: ["Groceries", "Kirana, fresh produce & dairy"],
  new: ["Discover", "Explore newly opened shops near you"],
};

/** Shop card with preview items and "View Items >" header */
function ShopWithItemsCard({
  seller,
  onAddToCart,
  addingPid,
}: {
  seller: Seller;
  onAddToCart: (p: Product) => void;
  addingPid: string | null;
}) {
  const { colors } = useTheme();

  // Fetch shop products
  const productsQuery = useQuery({
    queryKey: ["seller-products", seller.id],
    queryFn: () => api<{ seller: Seller; products: Product[] }>(`/sellers/${seller.id}`),
    staleTime: 60000,
  });

  const products = productsQuery.data?.products ?? [];

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        marginBottom: spacing.lg,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
      }}
    >
      {/* 1. Header Row */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
        }}
      >
        <View style={{ flex: 1, marginRight: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View
              style={{
                backgroundColor: colors.surfaceTertiary,
                borderRadius: 4,
                paddingHorizontal: 4,
                paddingVertical: 1,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: "700", color: colors.muted }}>Ad</Text>
            </View>
            <Text
              style={{
                fontSize: font.xl,
                fontWeight: "900",
                color: colors.onSurface,
                flexShrink: 1,
                letterSpacing: -0.3,
              }}
              numberOfLines={1}
            >
              {seller.name}
            </Text>
          </View>

          {/* Rating, Count, ETA Row */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
                backgroundColor: "#228B22",
                borderRadius: radius.sm - 2,
                paddingHorizontal: 5,
                paddingVertical: 2,
              }}
            >
              <Ionicons name="star" size={11} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "800" }}>
                {seller.rating ? seller.rating.toFixed(1) : "4.2"}
              </Text>
            </View>
            <Text style={{ fontSize: font.sm, color: colors.muted, fontWeight: "600" }}>
              (10K+) • {seller.eta_min ? `${seller.eta_min - 5 > 0 ? seller.eta_min - 5 : 10}-${seller.eta_min} mins` : "15-20 mins"}
            </Text>
          </View>

          {/* Offer text */}
          {seller.offer ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
              <Ionicons name="pricetag" size={13} color="#FC8019" />
              <Text style={{ fontSize: font.sm, color: colors.onSurfaceSecondary, fontWeight: "700" }}>
                {seller.offer}
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
              <Ionicons name="pricetag" size={13} color="#FC8019" />
              <Text style={{ fontSize: font.sm, color: colors.onSurfaceSecondary, fontWeight: "700" }}>
                50% off upto ₹100
              </Text>
            </View>
          )}
        </View>

        {/* View Items > button */}
        <Pressable
          hitSlop={8}
          onPress={() => router.push(`/seller/${seller.id}`)}
          style={{ flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2 }}
        >
          <Text style={{ color: colors.brandPrimary, fontWeight: "800", fontSize: font.base }}>
            View Items
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.brandPrimary} />
        </Pressable>
      </View>

      {/* 2. Items Horizontal Carousel */}
      {productsQuery.isLoading ? (
        <View style={{ height: 230, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={colors.brandPrimary} />
        </View>
      ) : products.length === 0 ? (
        <Pressable
          onPress={() => router.push(`/seller/${seller.id}`)}
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.md,
            height: 120,
            borderRadius: radius.md,
            backgroundColor: colors.surfaceSecondary,
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
          }}
        >
          <Ionicons name="restaurant-outline" size={28} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: font.sm, fontWeight: "600" }}>
            Tap to explore full shop menu
          </Text>
        </Pressable>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            gap: spacing.md,
          }}
        >
          {products.slice(0, 8).map((p) => {
            const isAdding = addingPid === p.id;
            return (
              <View
                key={p.id}
                style={{
                  width: 170,
                  backgroundColor: colors.surface,
                }}
              >
                {/* Product Image */}
                <View
                  style={{
                    width: 170,
                    height: 140,
                    borderRadius: radius.lg,
                    overflow: "hidden",
                    backgroundColor: colors.surfaceTertiary,
                  }}
                >
                  <Image
                    source={{ uri: mediaUri(p.image || seller.image) }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={200}
                  />
                </View>

                {/* Veg / Non-veg marker */}
                <View style={{ marginTop: spacing.sm }}>
                  <VegMark veg={p.veg} />
                </View>

                {/* Product Title */}
                <Text
                  numberOfLines={2}
                  style={{
                    fontSize: font.base,
                    fontWeight: "700",
                    color: colors.onSurface,
                    marginTop: 4,
                    minHeight: 38,
                    lineHeight: 19,
                  }}
                >
                  {p.name}
                </Text>

                {/* Price and ADD button row */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: spacing.xs,
                  }}
                >
                  <View>
                    <Text
                      style={{
                        fontSize: font.sm,
                        color: colors.muted,
                        textDecorationLine: "line-through",
                      }}
                    >
                      {rupee(Math.round(p.price * 1.35))}
                    </Text>
                    <View
                      style={{
                        backgroundColor: "#FFEB3B",
                        paddingHorizontal: 4,
                        paddingVertical: 1,
                        borderRadius: 3,
                        alignSelf: "flex-start",
                        marginTop: 1,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: font.base,
                          fontWeight: "900",
                          color: "#1A1A1A",
                        }}
                      >
                        {rupee(p.price)}
                      </Text>
                    </View>
                  </View>

                  {/* ADD button */}
                  <Pressable
                    disabled={isAdding}
                    onPress={() => onAddToCart(p)}
                    style={({ pressed }) => [
                      {
                        borderWidth: 1,
                        borderColor: colors.borderStrong,
                        backgroundColor: colors.surface,
                        borderRadius: radius.md,
                        paddingHorizontal: 16,
                        paddingVertical: 7,
                        minWidth: 64,
                        alignItems: "center",
                        justifyContent: "center",
                        shadowColor: "#000",
                        shadowOpacity: 0.05,
                        shadowRadius: 3,
                        shadowOffset: { width: 0, height: 1 },
                        elevation: 1,
                      },
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    {isAdding ? (
                      <ActivityIndicator size="small" color={colors.success} />
                    ) : (
                      <Text
                        style={{
                          color: colors.success,
                          fontWeight: "800",
                          fontSize: font.sm + 1,
                        }}
                      >
                        ADD
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const CATEGORIES: { key: string; label: string; icon: IconName }[] = [
  { key: "all", label: "All", icon: "sparkles-outline" },
  { key: "new", label: "Newly Opened", icon: "time-outline" },
  { key: "recently_registered", label: "Recently Registered", icon: "business-outline" },
  { key: "food", label: "Food", icon: "fast-food-outline" },
  { key: "grocery", label: "Groceries", icon: "basket-outline" },
  { key: "cloud_kitchen", label: "Cloud Kitchens", icon: "restaurant-outline" },
];

export default function DiscoverScreen() {
  const params = useLocalSearchParams<{ type?: string; schedule?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useStyles();
  const qc = useQueryClient();
  const toast = useToast();

  const isScheduleMode = !!params.schedule;
  const isFoodMode = params.type === "food";
  const isListViewMode = isScheduleMode || isFoodMode;
  const isDiscoverMode = !params.schedule && (!params.type || params.type === "new");

  // Query for category listing when in schedule mode or standard category mode
  const listCategory = params.type || "food";
  const categoryQuery = useQuery({
    queryKey: ["sellers", listCategory],
    queryFn: () => api<Seller[]>(`/sellers?category=${listCategory}`),
    enabled: isListViewMode,
  });
  const [listTitle, listSub] = TITLES[listCategory] ?? ["Shops", ""];

  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [addingPid, setAddingPid] = useState<string | null>(null);
  const [containerHeight, setContainerHeight] = useState<number>(0);

  // Default address for location discovery
  const addr = useQuery({ queryKey: ["addresses"], queryFn: () => api<Address[]>("/addresses") });
  const defaultAddress = addr.data?.find((a) => a.is_default) || addr.data?.[0];

  // Infinite query for showcase feed
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<DiscoverResponse>({
    queryKey: ["discover-feed", selectedCat, activeSearch],
    initialPageParam: 0,
    enabled: isDiscoverMode,
    queryFn: ({ pageParam = 0 }) => {
      const qParams = new URLSearchParams();
      if (selectedCat && selectedCat !== "all") qParams.append("category", selectedCat);
      if (activeSearch.trim()) qParams.append("q", activeSearch.trim());
      qParams.append("limit", "6");
      qParams.append("offset", String(pageParam));
      return api<DiscoverResponse>(`/discover?${qParams.toString()}`);
    },
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.offset + lastPage.limit : undefined),
  });

  // Flattened items for virtualized FlatList
  const showcaseItems = useMemo(() => {
    return (data?.pages.flatMap((page) => page.items) ?? []) as ShowcaseItem[];
  }, [data]);

  // Add product to cart directly from discover card
  const addToCart = async (product: Product, seller: Seller) => {
    setAddingPid(product.id);
    try {
      await api("/cart/items", { method: "POST", body: { product_id: product.id, qty: 1 } });
      qc.invalidateQueries({ queryKey: ["cart"] });
      toast(`Added ${product.name} to cart`);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 409) {
        toast("Cart contains items from another shop. Clear cart first or open shop.", "err");
      } else {
        toast(e.message || "Could not add item", "err");
      }
    } finally {
      setAddingPid(null);
    }
  };

  const handleSearchSubmit = () => {
    setActiveSearch(searchQuery);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setActiveSearch("");
  };

  // Render individual showcase card with clean, minimal subtle fade-in animation
  const renderShowcase = ({ item, index }: { item: ShowcaseItem; index: number }) => {
    const { seller, banner_url, gallery, highlights, description, products } = item;
    const isRecentlyOpened = seller.is_new;
    const hasOffer = !!seller.offer;

    // Dynamic banner height: 32% of available container height (e.g., ~250-260dp on tall phones, min 220dp)
    const dynamicBannerHeight = containerHeight > 0 ? Math.max(220, Math.round(containerHeight * 0.32)) : 240;

    return (
      <View
        style={[s.card, containerHeight > 0 && { height: containerHeight }]}
        testID={`discover-showcase-${seller.id}`}
      >
        {/* 1. Large Full-width Banner with Badges and Gradient Title */}
        <Pressable
          onPress={() => router.push(`/seller/${seller.id}`)}
          style={[s.bannerContainer, { height: dynamicBannerHeight }]}
          testID={`discover-banner-${seller.id}`}
        >
          <Image source={{ uri: banner_url }} style={s.bannerImage} contentFit="cover" transition={200} />
          <LinearGradient
            colors={["rgba(0,0,0,0.45)", "transparent", "rgba(0,0,0,0.85)"]}
            style={s.bannerGradient}
          >
            {/* Top Badges */}
            <View style={s.badgeRow}>
              {isRecentlyOpened ? (
                <View style={[s.badge, { backgroundColor: colors.brandPrimary }]}>
                  <Ionicons name="sparkles" size={12} color={colors.onBrandPrimary} />
                  <Text style={s.badgeText}>NEW</Text>
                </View>
              ) : null}
              {seller.opened_on ? (
                <View style={[s.badge, { backgroundColor: "rgba(0,0,0,0.65)" }]}>
                  <Text style={s.badgeText}>Recently Opened</Text>
                </View>
              ) : null}
              {seller.open === false ? (
                <View style={[s.badge, { backgroundColor: colors.error }]}>
                  <Text style={s.badgeText}>Currently Closed</Text>
                </View>
              ) : null}
            </View>

            {/* Banner Bottom: Shop Name & Cuisine */}
            <View>
              <Text style={s.bannerShopName}>{seller.name}</Text>
              <Text style={s.bannerCuisine}>{seller.cuisine || seller.category.toUpperCase()}</Text>
            </View>
          </LinearGradient>
        </Pressable>

        {/* 2. Shop Details Section with Bottom Anchored CTA */}
        <Animated.View entering={FadeIn.duration(250)} style={s.detailsSection}>
          <ScrollView
            style={s.detailsScroll}
            contentContainerStyle={s.detailsContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            <View style={s.metaRow}>
              {/* Rating */}
              <View style={s.ratingPill}>
                <Ionicons name="star" size={13} color="#FFFFFF" />
                <Text style={s.ratingText}>{seller.rating.toFixed(1)}</Text>
              </View>

              {/* Distance & ETA */}
              <View style={s.metaItem}>
                <Ionicons name="location-outline" size={14} color={colors.muted} />
                <Text style={s.metaText}>{seller.distance_km} km</Text>
              </View>
              <View style={s.metaDot} />
              <View style={s.metaItem}>
                <Ionicons name="time-outline" size={14} color={colors.muted} />
                <Text style={s.metaText}>{seller.eta_min} mins</Text>
              </View>

              {/* FSSAI Verified Pill */}
              {seller.fssai_status === "verified" ? (
                <View style={s.fssaiPill}>
                  <Ionicons name="shield-checkmark" size={12} color={colors.onPastelMint} />
                  <Text style={s.fssaiText}>FSSAI Verified</Text>
                </View>
              ) : null}
            </View>

            {/* Shop Description */}
            <Text style={s.descriptionText} numberOfLines={2}>
              {description}
            </Text>

            {/* Special Offer Badge if available */}
            {hasOffer ? (
              <View style={s.offerBox}>
                <Ionicons name="pricetag" size={14} color={colors.brandPrimary} />
                <Text style={s.offerText}>{seller.offer}</Text>
              </View>
            ) : null}

            {/* 3. Multiple Shop Photographs (Horizontal Swipe Gallery) */}
            {gallery && gallery.length > 0 ? (
              <View style={s.galleryContainer}>
                <Text style={s.subSectionTitle}>Shop Highlights & Ambience</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.galleryList}
                  nestedScrollEnabled
                >
                  {gallery.map((imgUri, index) => (
                    <Pressable
                      key={`gal-${seller.id}-${index}`}
                      onPress={() => setPreviewImage(imgUri)}
                      style={s.galleryItem}
                      testID={`discover-gallery-img-${seller.id}-${index}`}
                    >
                      <Image source={{ uri: imgUri }} style={s.galleryImage} contentFit="cover" transition={200} />
                      <View style={s.galleryZoomIcon}>
                        <Ionicons name="expand-outline" size={12} color="#FFFFFF" />
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {/* 4. Highlights Tags */}
            {highlights && highlights.length > 0 ? (
              <View style={s.highlightsRow}>
                {highlights.map((tag, idx) => (
                  <View key={`hl-${idx}`} style={s.highlightChip}>
                    <Text style={s.highlightText}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* 5. Product Preview Section */}
            {products && products.length > 0 ? (
              <View style={s.productsSection}>
                <View style={s.productsHeader}>
                  <Text style={s.subSectionTitle}>Popular Items</Text>
                  <Pressable onPress={() => router.push(`/seller/${seller.id}`)}>
                    <Text style={s.viewAllLink}>View all ({item.total_products})</Text>
                  </Pressable>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.productList}
                  nestedScrollEnabled
                >
                  {products.map((prod) => (
                    <View key={prod.id} style={s.productCard} testID={`discover-prod-${prod.id}`}>
                      <Image source={{ uri: prod.image }} style={s.productImage} contentFit="cover" transition={150} />
                      <View style={s.productInfo}>
                        <Text style={s.productName} numberOfLines={1}>
                          {prod.name}
                        </Text>
                        <Text style={s.productPrice}>{rupee(prod.price)}</Text>
                        <Pressable
                          style={[s.addBtn, addingPid === prod.id && { opacity: 0.6 }]}
                          onPress={() => addToCart(prod, seller)}
                          disabled={addingPid === prod.id}
                          testID={`discover-add-cart-${prod.id}`}
                        >
                          {addingPid === prod.id ? (
                            <ActivityIndicator size="small" color={colors.brandPrimary} />
                          ) : (
                            <>
                              <Ionicons name="add" size={14} color={colors.brandPrimary} />
                              <Text style={s.addBtnText}>ADD</Text>
                            </>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </ScrollView>

          {/* 6. Shop CTA Button anchored at bottom of card */}
          <View style={s.ctaContainer}>
            <Pressable
              style={s.exploreBtn}
              onPress={() => router.push(`/seller/${seller.id}`)}
              testID={`discover-explore-${seller.id}`}
            >
              <Text style={s.exploreBtnText}>Explore Shop & Full Menu</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.onBrandPrimary} />
            </Pressable>
          </View>
        </Animated.View>
      </View>
    );
  };

  if (isListViewMode) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <Header title={listTitle} subtitle={listSub} />
        {isScheduleMode ? (
          <View
            testID="listing-schedule-banner"
            style={{
              margin: spacing.lg,
              marginBottom: spacing.xs,
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.pastelLilac,
              flexDirection: "row",
              gap: spacing.sm,
              alignItems: "center",
            }}
          >
            <Ionicons name="time-outline" size={20} color={colors.onPastelLilac} />
            <Text
              style={{
                color: colors.onPastelLilac,
                flex: 1,
                fontSize: font.sm + 1,
                fontWeight: "600",
                lineHeight: 20,
              }}
            >
              Add items, then choose a delivery slot in your cart.
            </Text>
          </View>
        ) : null}

        {categoryQuery.isLoading ? (
          <Loader />
        ) : categoryQuery.isError ? (
          <ErrorState
            message={(categoryQuery.error as Error)?.message || "Failed to load shops"}
            onRetry={() => categoryQuery.refetch()}
          />
        ) : (
          <FlatList
            testID={`listing-${listCategory}`}
            data={categoryQuery.data}
            keyExtractor={(s) => s.id}
            contentContainerStyle={{
              paddingVertical: spacing.sm,
              paddingBottom: insets.bottom + spacing.xl,
            }}
            renderItem={({ item }) => (
              <ShopWithItemsCard
                seller={item}
                onAddToCart={(p) => addToCart(p, item)}
                addingPid={addingPid}
              />
            )}
            ListEmptyComponent={
              <EmptyState
                icon="storefront-outline"
                title="No shops here yet"
                body="We're onboarding more local businesses in your area."
              />
            }
          />
        )}
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* A. Header */}
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={s.headerTopRow}>
          <Pressable onPress={() => router.back()} style={s.backBtn} testID="discover-back-btn">
            <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
          </Pressable>
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={s.headerTitle}>Discover</Text>
            <Text style={s.headerSubtitle}>Explore newly opened shops near you</Text>
          </View>
          {defaultAddress ? (
            <View style={s.locationBadge}>
              <Ionicons name="location" size={14} color={colors.brandPrimary} />
              <Text style={s.locationText} numberOfLines={1}>
                {defaultAddress.label || "Home"}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Search Bar */}
        <View style={s.searchBarContainer}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search new spots, cuisines, dishes..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
            testID="discover-search-input"
          />
          {searchQuery ? (
            <Pressable onPress={clearSearch} style={{ padding: spacing.xs }}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        {/* B. Category Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.categoryFilterBar}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCat === cat.key;
            return (
              <Pressable
                key={cat.key}
                onPress={() => setSelectedCat(cat.key)}
                style={[
                  s.categoryChip,
                  isSelected && {
                    backgroundColor: colors.brandPrimary,
                    borderColor: colors.brandPrimary,
                  },
                ]}
                testID={`discover-cat-${cat.key}`}
              >
                <Ionicons
                  name={cat.icon}
                  size={14}
                  color={isSelected ? colors.onBrandPrimary : colors.onSurface}
                />
                <Text
                  style={[
                    s.categoryChipText,
                    isSelected && { color: colors.onBrandPrimary, fontWeight: "700" },
                  ]}
                >
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* C. Shop Showcase Feed */}
      <View
        style={s.feedContainer}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && Math.abs(h - containerHeight) > 2) {
            setContainerHeight(h);
          }
        }}
      >
        {isLoading ? (
          <Loader />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message || "Failed to load discovery feed"} onRetry={() => refetch()} />
        ) : (
          <FlatList
            data={showcaseItems}
            keyExtractor={(item) => item.seller.id}
            renderItem={renderShowcase}
            pagingEnabled
            snapToInterval={containerHeight > 0 ? containerHeight : undefined}
            snapToAlignment="start"
            decelerationRate="fast"
            disableIntervalMomentum={true}
            showsVerticalScrollIndicator={false}
            getItemLayout={
              containerHeight > 0
                ? (_, i) => ({ length: containerHeight, offset: containerHeight * i, index: i })
                : undefined
            }
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) fetchNextPage();
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isFetchingNextPage ? (
                <View style={s.footerLoader}>
                  <ActivityIndicator size="small" color={colors.brandPrimary} />
                  <Text style={s.footerText}>Loading more businesses...</Text>
                </View>
              ) : undefined
            }
            ListEmptyComponent={
              <EmptyState
                icon="compass-outline"
                title="No shops found"
                body="No recently opened or matching businesses found for this filter. Try another category."
              />
            }
          />
        )}
      </View>

      {/* Full-screen Image Viewer Modal */}
      <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <View style={s.modalOverlay}>
          <Pressable style={s.modalCloseBtn} onPress={() => setPreviewImage(null)}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
          {previewImage ? (
            <Image source={{ uri: previewImage }} style={s.modalImage} contentFit="contain" />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: {
    flex: 1,
    backgroundColor: c.surface,
  },
  header: {
    backgroundColor: c.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: font.xl,
    fontWeight: "800",
    color: c.onSurface,
  },
  headerSubtitle: {
    fontSize: font.sm,
    color: c.muted,
  },
  locationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: c.brandTertiary,
  },
  locationText: {
    fontSize: font.sm - 2,
    fontWeight: "700",
    color: c.brandPrimary,
    maxWidth: 90,
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 42,
    marginTop: spacing.sm,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: c.border,
  },
  searchInput: {
    flex: 1,
    fontSize: font.base,
    color: c.onSurface,
    paddingVertical: 0,
  },
  categoryFilterBar: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
  },
  categoryChipText: {
    fontSize: font.sm,
    color: c.onSurface,
    fontWeight: "600",
  },
  feedContainer: {
    flex: 1,
  },
  card: {
    backgroundColor: c.surface,
    overflow: "hidden",
  },
  bannerContainer: {
    height: 190,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    borderRadius: radius.lg,
    overflow: "hidden",
    position: "relative",
  },
  bannerImage: {
    ...StyleSheet.absoluteFill,
  },
  bannerGradient: {
    ...StyleSheet.absoluteFill,
    justifyContent: "space-between",
    padding: spacing.md,
  },
  badgeRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: font.sm - 2,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  bannerShopName: {
    fontSize: font.xxl,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  bannerCuisine: {
    fontSize: font.sm,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
  },
  detailsSection: {
    flex: 1,
    justifyContent: "space-between",
  },
  detailsScroll: {
    flex: 1,
  },
  detailsContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  ctaContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
    backgroundColor: c.surface,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#16A34A",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  ratingText: {
    color: "#FFFFFF",
    fontSize: font.sm - 2,
    fontWeight: "800",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    fontSize: font.sm,
    color: c.muted,
    fontWeight: "500",
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: c.muted,
  },
  fssaiPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: c.pastelMint,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  fssaiText: {
    fontSize: font.sm - 2,
    fontWeight: "700",
    color: c.onPastelMint,
  },
  descriptionText: {
    fontSize: font.base,
    color: c.onSurfaceSecondary,
    lineHeight: 20,
  },
  offerBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: c.brandTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
  },
  offerText: {
    fontSize: font.sm,
    fontWeight: "700",
    color: c.brandPrimary,
  },
  galleryContainer: {
    gap: spacing.xs,
  },
  subSectionTitle: {
    fontSize: font.base,
    fontWeight: "700",
    color: c.onSurface,
  },
  galleryList: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  galleryItem: {
    width: 110,
    height: 80,
    borderRadius: radius.md,
    overflow: "hidden",
    position: "relative",
  },
  galleryImage: {
    width: "100%",
    height: "100%",
  },
  galleryZoomIcon: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: radius.pill,
    padding: 3,
  },
  highlightsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  highlightChip: {
    backgroundColor: c.surfaceSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
  },
  highlightText: {
    fontSize: font.sm - 1,
    color: c.onSurface,
    fontWeight: "600",
  },
  productsSection: {
    gap: spacing.xs,
  },
  productsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  viewAllLink: {
    fontSize: font.sm,
    fontWeight: "700",
    color: c.brandPrimary,
  },
  productList: {
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  productCard: {
    width: 140,
    backgroundColor: c.surfaceSecondary,
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: c.border,
  },
  productImage: {
    width: "100%",
    height: 90,
  },
  productInfo: {
    padding: spacing.sm,
    gap: 3,
  },
  productName: {
    fontSize: font.sm,
    fontWeight: "700",
    color: c.onSurface,
  },
  productPrice: {
    fontSize: font.sm,
    fontWeight: "800",
    color: c.brandPrimary,
  },
  addBtn: {
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderWidth: 1,
    borderColor: c.brandPrimary,
    backgroundColor: c.surface,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  addBtnText: {
    fontSize: font.sm - 2,
    fontWeight: "800",
    color: c.brandPrimary,
  },
  exploreBtn: {
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: c.brandPrimary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  exploreBtnText: {
    fontSize: font.base,
    fontWeight: "800",
    color: c.onBrandPrimary,
  },
  footerLoader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  footerText: {
    fontSize: font.sm,
    color: c.muted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.md,
  },
  modalCloseBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    padding: spacing.sm,
  },
  modalImage: {
    width: "100%",
    height: "80%",
  },
}));
