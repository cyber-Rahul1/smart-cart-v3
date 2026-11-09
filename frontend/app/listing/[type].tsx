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
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError } from "@/src/api";
import { rupee } from "@/src/format";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Address, DiscoverResponse, Product, Seller, ShowcaseItem } from "@/src/types";
import { EmptyState, ErrorState, IconName, Ionicons, Loader, useToast } from "@/src/ui";

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

  // Render individual showcase card with entrance animation applied to internal contents
  const renderShowcase = ({ item, index }: { item: ShowcaseItem; index: number }) => {
    const { seller, banner_url, gallery, highlights, description, products } = item;
    const isRecentlyOpened = seller.is_new;
    const hasOffer = !!seller.offer;
    const baseDelay = Math.min(index * 60, 240);

    return (
      <View
        style={[s.card, containerHeight > 0 && { height: containerHeight }]}
        testID={`discover-showcase-${seller.id}`}
      >
        {/* 1. Large Full-width Banner with Badges and Gradient Title */}
        <Pressable
          onPress={() => router.push(`/seller/${seller.id}`)}
          style={s.bannerContainer}
          testID={`discover-banner-${seller.id}`}
        >
          <Image source={{ uri: banner_url }} style={s.bannerImage} contentFit="cover" transition={200} />
          <LinearGradient
            colors={["rgba(0,0,0,0.45)", "transparent", "rgba(0,0,0,0.85)"]}
            style={s.bannerGradient}
          >
            {/* Top Badges: Animated FadeInDown */}
            <Animated.View
              entering={FadeInDown.delay(baseDelay + 40).duration(350).springify().damping(16)}
              style={s.badgeRow}
            >
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
            </Animated.View>

            {/* Banner Bottom: Shop Name & Cuisine Animated */}
            <Animated.View entering={FadeInDown.delay(baseDelay + 80).duration(350).springify().damping(16)}>
              <Text style={s.bannerShopName}>{seller.name}</Text>
              <Text style={s.bannerCuisine}>{seller.cuisine || seller.category.toUpperCase()}</Text>
            </Animated.View>
          </LinearGradient>
        </Pressable>

        {/* 2. Shop Details Section */}
        <ScrollView
          style={s.detailsSection}
          contentContainerStyle={s.detailsContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          <Animated.View
            entering={FadeInDown.delay(baseDelay + 120).duration(350).springify().damping(16)}
            style={s.metaRow}
          >
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
          </Animated.View>

          {/* Shop Description Animated */}
          <Animated.View entering={FadeInDown.delay(baseDelay + 160).duration(350).springify().damping(16)}>
            <Text style={s.descriptionText} numberOfLines={2}>
              {description}
            </Text>
          </Animated.View>

          {/* Special Offer Badge if available */}
          {hasOffer ? (
            <Animated.View
              entering={FadeInDown.delay(baseDelay + 180).duration(350).springify().damping(16)}
              style={s.offerBox}
            >
              <Ionicons name="pricetag" size={14} color={colors.brandPrimary} />
              <Text style={s.offerText}>{seller.offer}</Text>
            </Animated.View>
          ) : null}

          {/* 3. Multiple Shop Photographs (Horizontal Swipe Gallery) */}
          {gallery && gallery.length > 0 ? (
            <Animated.View
              entering={FadeInRight.delay(baseDelay + 200).duration(400).springify().damping(16)}
              style={s.galleryContainer}
            >
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
            </Animated.View>
          ) : null}

          {/* 4. Highlights Tags */}
          {highlights && highlights.length > 0 ? (
            <Animated.View
              entering={FadeInDown.delay(baseDelay + 220).duration(350).springify().damping(16)}
              style={s.highlightsRow}
            >
              {highlights.map((tag, idx) => (
                <View key={`hl-${idx}`} style={s.highlightChip}>
                  <Text style={s.highlightText}>{tag}</Text>
                </View>
              ))}
            </Animated.View>
          ) : null}

          {/* 5. Product Preview Section */}
          {products && products.length > 0 ? (
            <Animated.View
              entering={FadeInRight.delay(baseDelay + 240).duration(400).springify().damping(16)}
              style={s.productsSection}
            >
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
            </Animated.View>
          ) : null}

          {/* 6. Shop CTA Button */}
          <Animated.View entering={FadeInDown.delay(baseDelay + 260).duration(350).springify().damping(16)}>
            <Pressable
              style={s.exploreBtn}
              onPress={() => router.push(`/seller/${seller.id}`)}
              testID={`discover-explore-${seller.id}`}
            >
              <Text style={s.exploreBtnText}>Explore Shop & Full Menu</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.onBrandPrimary} />
            </Pressable>
          </Animated.View>
        </ScrollView>
      </View>
    );
  };

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
            snapToAlignment="start"
            decelerationRate="fast"
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
    width: "100%",
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
  },
  detailsContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
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
