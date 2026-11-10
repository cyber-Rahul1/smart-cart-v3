import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError } from "@/src/api";
import { rupee, mediaUri } from "@/src/format";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { DiscoverResponse, Product, Seller, ShowcaseItem } from "@/src/types";
import { EmptyState, ErrorState, Header, IconName, Ionicons, Loader, useToast, VegMark } from "@/src/ui";

const TITLES: Record<string, [string, string]> = {
  food: ["Food", "Restaurants & cloud kitchens near you"],
  grocery: ["Groceries", "Kirana, fresh produce & dairy"],
  new: ["Discover", "Explore newly opened shops near you"],
};

/** Shop card with preview items for generic food/grocery listing */
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

        <Pressable
          hitSlop={8}
          onPress={() => router.push(`/seller/${seller.id}`)}
          style={{ flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2 }}
        >
          <Text style={{ color: "#2E7D32", fontWeight: "800", fontSize: font.base }}>
            View Items
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#2E7D32" />
        </Pressable>
      </View>

      {productsQuery.isLoading ? (
        <View style={{ height: 230, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color="#2E7D32" />
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

                <View style={{ marginTop: spacing.sm }}>
                  <VegMark veg={p.veg} />
                </View>

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
                      {rupee(Math.round(p.price * 1.25))}
                    </Text>
                    <Text
                      style={{
                        fontSize: font.base,
                        fontWeight: "800",
                        color: colors.onSurface,
                      }}
                    >
                      {rupee(p.price)}
                    </Text>
                  </View>

                  <Pressable
                    disabled={isAdding}
                    onPress={() => onAddToCart(p)}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.borderStrong,
                      backgroundColor: colors.surface,
                      borderRadius: radius.sm,
                      paddingHorizontal: spacing.md,
                      paddingVertical: 5,
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 64,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.08,
                      shadowRadius: 2,
                      elevation: 1,
                    }}
                  >
                    {isAdding ? (
                      <ActivityIndicator size="small" color="#2E7D32" />
                    ) : (
                      <Text
                        style={{
                          color: "#2E7D32",
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

/** Filter chips matching reference design */
const CATEGORIES: { key: string; label: string; icon: IconName }[] = [
  { key: "all", label: "All", icon: "sparkles" },
  { key: "new", label: "Newly Opened", icon: "time-outline" },
  { key: "recently_registered", label: "Recently Registered", icon: "business-outline" },
  { key: "food", label: "Food", icon: "fast-food-outline" },
  { key: "grocery", label: "Groceries", icon: "basket-outline" },
];

/** Full Exact Discover Shop Card component */
function ExactDiscoverShopCard({
  item,
  onAddToCart,
  addingPid,
  onPreviewImage,
}: {
  item: ShowcaseItem;
  onAddToCart: (p: Product, s: Seller) => void;
  addingPid: string | null;
  onPreviewImage: (uri: string) => void;
}) {
  const { seller, banner_url, gallery, description, products } = item;
  const s = useStyles();
  const toast = useToast();
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const bannerScrollRef = useRef<FlatList<any>>(null);

  // Banner image carousel items
  const bannerImages = useMemo(() => {
    const list: string[] = [];
    if (banner_url) list.push(banner_url);
    if (gallery && gallery.length > 0) {
      gallery.forEach((g) => {
        if (!list.includes(g)) list.push(g);
      });
    }
    if (list.length === 0 && seller.image) list.push(seller.image);
    return list.slice(0, 4);
  }, [banner_url, gallery, seller.image]);

  // Ambience gallery items (with video timestamp mock on item 2 like screenshot)
  const ambienceImages = useMemo(() => {
    if (gallery && gallery.length >= 4) return gallery.slice(0, 4);
    const fallbacks = [
      banner_url || seller.image,
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=70",
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=70",
      "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=70",
    ];
    return fallbacks;
  }, [gallery, banner_url, seller.image]);

  // Format reviews count
  const reviewCountDisplay = seller.reviews_count
    ? `${(seller.reviews_count / 1000).toFixed(1)}k`
    : "1.2k";

  // Formatted address line
  const displayAddress =
    seller.address && seller.address.includes("MVP Colony")
      ? seller.address
      : `${seller.address || "D.No. 12-5-34, MVP Colony"}, Visakhapatnam, Andhra Pradesh - 530017`;

  const handleCall = () => {
    const phone = seller.phone || "+919876543210";
    Linking.openURL(`tel:${phone}`).catch(() => toast("Unable to open dialer", "err"));
  };

  const handleChat = () => {
    toast(`Opening chat with ${seller.name}`);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: seller.name,
        message: `Check out ${seller.name} on GathrCart! Discover authentic dishes and group orders.`,
      });
    } catch {}
  };

  const handleDirections = () => {
    const query = encodeURIComponent(`${seller.name}, ${seller.address || "Visakhapatnam"}`);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`).catch(() =>
      toast("Unable to open Google Maps", "err")
    );
  };

  const handleBannerScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const width = e.nativeEvent.layoutMeasurement.width;
    if (width > 0) {
      const idx = Math.round(offsetX / width);
      setActiveBannerIdx(idx);
    }
  };

  const scrollBannerTo = (nextIdx: number) => {
    const target = Math.max(0, Math.min(bannerImages.length - 1, nextIdx));
    bannerScrollRef.current?.scrollToIndex({ index: target, animated: true });
    setActiveBannerIdx(target);
  };

  return (
    <View style={s.shopCardContainer} testID={`discover-shop-${seller.id}`}>
      {/* 1. HERO BANNER WITH CAROUSEL, BADGES & ARROWS */}
      <View style={s.heroBannerWrapper}>
        <FlatList
          ref={bannerScrollRef}
          data={bannerImages}
          keyExtractor={(_, i) => `hero-${i}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleBannerScroll}
          renderItem={({ item: imgUri }) => (
            <View style={s.heroBannerSlide}>
              <Image source={{ uri: mediaUri(imgUri) }} style={s.heroBannerImage} contentFit="cover" transition={200} />
            </View>
          )}
        />

        {/* Top Badges Row */}
        <View style={s.heroTopBadges}>
          <View style={s.heroTopLeftBadges}>
            {/* New Badge */}
            <View style={s.badgeNew}>
              <Ionicons name="sparkles" size={11} color="#FFFFFF" />
              <Text style={s.badgeNewText}>New</Text>
            </View>

            {/* Recently Opened */}
            <View style={s.badgeDark}>
              <Text style={s.badgeDarkText}>Recently Opened</Text>
            </View>

            {/* Cloud Kitchen */}
            <View style={s.badgeLightPill}>
              <Ionicons name="restaurant" size={12} color="#1A1A1A" />
              <Text style={s.badgeLightPillText}>Cloud Kitchen</Text>
            </View>
          </View>

          {/* Top Right: Video duration badge */}
          <View style={s.badgeVideo}>
            <Ionicons name="play" size={11} color="#FFFFFF" />
            <Text style={s.badgeVideoText}>0:20</Text>
          </View>
        </View>

        {/* Left Arrow Button */}
        {activeBannerIdx > 0 && (
          <Pressable
            style={s.heroArrowLeft}
            hitSlop={8}
            onPress={() => scrollBannerTo(activeBannerIdx - 1)}
          >
            <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
          </Pressable>
        )}

        {/* Right Arrow Button */}
        {activeBannerIdx < bannerImages.length - 1 && (
          <Pressable
            style={s.heroArrowRight}
            hitSlop={8}
            onPress={() => scrollBannerTo(activeBannerIdx + 1)}
          >
            <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
          </Pressable>
        )}

        {/* Bottom Right Pagination Dots */}
        <View style={s.heroDotsContainer}>
          {bannerImages.map((_, i) => (
            <View
              key={`dot-${i}`}
              style={[
                s.heroDot,
                i === activeBannerIdx ? s.heroDotActive : s.heroDotInactive,
              ]}
            />
          ))}
        </View>
      </View>

      {/* 2. SHOP IDENTITY HEADER (Icon, Title, Heart, Tags, Rating, ETA, Distance, FSSAI) */}
      <View style={s.shopHeaderRow}>
        {/* Black Square Logo */}
        <View style={s.shopLogoBox}>
          <Ionicons name="restaurant-outline" size={26} color="#FFFFFF" />
          <Text style={s.shopLogoText}>Test{"\n"}Kitchen</Text>
        </View>

        {/* Info Column */}
        <View style={s.shopHeaderInfo}>
          <View style={s.shopTitleRow}>
            <Text style={s.shopNameTitle} numberOfLines={1}>
              {seller.name}
            </Text>
            <Pressable
              hitSlop={8}
              onPress={() => {
                setIsSaved(!isSaved);
                toast(isSaved ? "Removed from favorites" : "Saved to favorites");
              }}
              style={s.heartIconBtn}
            >
              <Ionicons
                name={isSaved ? "heart" : "heart-outline"}
                size={22}
                color={isSaved ? "#E53935" : "#1A1A1A"}
              />
            </Pressable>
          </View>

          {/* Subtitle / Cuisines */}
          <Text style={s.shopCuisinesText} numberOfLines={1}>
            {seller.cuisine || "Biryani • North Indian • Indian"}
          </Text>

          {/* Metrics Row: Rating, Reviews, Time, Distance, FSSAI */}
          <View style={s.shopMetricsRow}>
            {/* Green Rating Pill */}
            <View style={s.ratingBadgeGreen}>
              <Ionicons name="star" size={11} color="#FFFFFF" />
              <Text style={s.ratingBadgeText}>{seller.rating ? seller.rating.toFixed(1) : "4.0"}</Text>
            </View>

            {/* Review count in parentheses */}
            <Text style={s.reviewsCountText}>({reviewCountDisplay} reviews)</Text>

            {/* Time ETA */}
            <View style={s.metricItemWithIcon}>
              <Ionicons name="time-outline" size={13} color="#666666" />
              <Text style={s.metricText}>{seller.eta_min || 26} mins</Text>
            </View>

            {/* Distance */}
            <View style={s.metricItemWithIcon}>
              <Ionicons name="location-outline" size={13} color="#666666" />
              <Text style={s.metricText}>{seller.distance_km || 1.5} km</Text>
            </View>

            {/* FSSAI Verified Pill with Green Check */}
            <View style={s.fssaiBadge}>
              <Ionicons name="checkmark-circle" size={13} color="#2E7D32" />
              <Text style={s.fssaiBadgeText}>FSSAI Verified</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 3. DESCRIPTION WITH "Read more" TOGGLE */}
      <View style={s.descriptionBlock}>
        <Text
          style={s.shopDescText}
          numberOfLines={isDescExpanded ? undefined : 2}
        >
          {description ||
            seller.description ||
            "Authentic, restaurant-style Biryani and Indian meals crafted with premium spices and fresh ingredients."}
        </Text>
        <Pressable
          hitSlop={6}
          onPress={() => setIsDescExpanded(!isDescExpanded)}
          style={s.readMoreBtn}
        >
          <Text style={s.readMoreText}>{isDescExpanded ? "Show less" : "Read more"}</Text>
          <Ionicons
            name={isDescExpanded ? "chevron-up" : "chevron-down"}
            size={14}
            color="#2E7D32"
          />
        </Pressable>
      </View>

      {/* 4. ACTION BUTTONS: Call, Chat, Share, Directions (Green filled pill) */}
      <View style={s.actionButtonsRow}>
        <Pressable style={s.actionOutlineBtn} onPress={handleCall}>
          <Ionicons name="call-outline" size={16} color="#1A1A1A" />
          <Text style={s.actionOutlineBtnText}>Call</Text>
        </Pressable>

        <Pressable style={s.actionOutlineBtn} onPress={handleChat}>
          <Ionicons name="chatbubble-outline" size={16} color="#1A1A1A" />
          <Text style={s.actionOutlineBtnText}>Chat</Text>
        </Pressable>

        <Pressable style={s.actionOutlineBtn} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={16} color="#1A1A1A" />
          <Text style={s.actionOutlineBtnText}>Share</Text>
        </Pressable>

        <Pressable style={s.directionsPillBtn} onPress={handleDirections}>
          <Ionicons name="navigate" size={15} color="#2E7D32" />
          <Text style={s.directionsPillBtnText}>Directions</Text>
        </Pressable>
      </View>

      {/* 5. ADDRESS CARD WITH MINI MAP PREVIEW */}
      <Pressable style={s.addressCardBox} onPress={handleDirections}>
        <View style={s.addressPinCircle}>
          <Ionicons name="location-sharp" size={16} color="#2E7D32" />
        </View>

        <View style={s.addressInfoCol}>
          <Text style={s.addressTitleLabel}>Address</Text>
          <Text style={s.addressFullText} numberOfLines={2}>
            {displayAddress}
          </Text>
        </View>

        {/* Stylized Mini Map Card */}
        <View style={s.miniMapWrapper}>
          <View style={s.miniMapRoadH} />
          <View style={s.miniMapRoadV} />
          <View style={s.miniMapPinDot}>
            <Ionicons name="location-sharp" size={14} color="#2E7D32" />
          </View>
          <Ionicons name="chevron-forward" size={14} color="#666666" style={s.mapChevron} />
        </View>
      </Pressable>

      {/* 6. SHOP AMBIENCE & HIGHLIGHTS (Horizontal Photos) */}
      <View style={s.sectionBlock}>
        <View style={s.sectionHeaderRow}>
          <Text style={s.sectionTitleText}>Shop Ambience & Highlights</Text>
          <Pressable
            hitSlop={6}
            onPress={() => router.push(`/seller/${seller.id}`)}
            style={s.viewAllRow}
          >
            <Text style={s.viewAllGreenText}>View all (6)</Text>
            <Ionicons name="chevron-forward" size={14} color="#2E7D32" />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.ambienceScrollContainer}
        >
          {ambienceImages.map((uri, idx) => (
            <Pressable
              key={`amb-${seller.id}-${idx}`}
              onPress={() => onPreviewImage(uri)}
              style={s.ambienceThumbCard}
            >
              <Image source={{ uri: mediaUri(uri) }} style={s.ambienceThumbImg} contentFit="cover" transition={200} />
              {/* If second item, show video pill 0:18 as in screenshot */}
              {idx === 1 && (
                <View style={s.ambienceVideoPill}>
                  <Ionicons name="play" size={10} color="#FFFFFF" />
                  <Text style={s.ambienceVideoText}>0:18</Text>
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* 7. POPULAR DISHES (Horizontal Dish Cards with Image, Name, Price, +ADD) */}
      <View style={s.sectionBlock}>
        <View style={s.sectionHeaderRow}>
          <Text style={s.sectionTitleText}>Popular Dishes</Text>
          <Pressable
            hitSlop={6}
            onPress={() => router.push(`/seller/${seller.id}`)}
            style={s.viewAllRow}
          >
            <Text style={s.viewAllGreenText}>View all ({item.total_products || 12})</Text>
            <Ionicons name="chevron-forward" size={14} color="#2E7D32" />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.dishesScrollContainer}
        >
          {(products && products.length > 0
            ? products.slice(0, 6)
            : [
                {
                  id: "sample-1",
                  seller_id: seller.id,
                  name: "Test Biryani",
                  price: 250,
                  category: "Biryani",
                  veg: false,
                  image:
                    banner_url ||
                    "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=70",
                  available: true,
                  stock: 50,
                  description: "",
                },
                {
                  id: "sample-2",
                  seller_id: seller.id,
                  name: "Biryani Speciality",
                  price: 320,
                  category: "Biryani",
                  veg: false,
                  image:
                    gallery?.[1] ||
                    "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800&q=70",
                  available: true,
                  stock: 50,
                  description: "",
                },
                {
                  id: "sample-3",
                  seller_id: seller.id,
                  name: "Chicken Biryani",
                  price: 280,
                  category: "Biryani",
                  veg: false,
                  image:
                    gallery?.[2] ||
                    "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=70",
                  available: true,
                  stock: 50,
                  description: "",
                },
              ]
          ).map((prod) => {
            const isAdding = addingPid === prod.id;
            return (
              <View key={prod.id} style={s.popularDishCard}>
                <Image
                  source={{ uri: mediaUri(prod.image || seller.image) }}
                  style={s.popularDishImg}
                  contentFit="cover"
                  transition={200}
                />
                <View style={s.popularDishContent}>
                  <Text style={s.popularDishName} numberOfLines={1}>
                    {prod.name}
                  </Text>
                  <Text style={s.popularDishPrice}>{rupee(prod.price)}</Text>
                  <Pressable
                    disabled={isAdding}
                    onPress={() => onAddToCart(prod as Product, seller)}
                    style={s.popularDishAddBtn}
                  >
                    {isAdding ? (
                      <ActivityIndicator size="small" color="#2E7D32" />
                    ) : (
                      <>
                        <Ionicons name="add" size={13} color="#2E7D32" />
                        <Text style={s.popularDishAddText}>ADD</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* 8. BOTTOM ANCHORED CTA: Explore Shop & Full Menu -> */}
      <View style={s.shopCtaWrapper}>
        <Pressable
          style={s.exploreShopBtn}
          onPress={() => router.push(`/seller/${seller.id}`)}
          testID={`discover-explore-${seller.id}`}
        >
          <Text style={s.exploreShopBtnText}>Explore Shop & Full Menu</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Card divider */}
      <View style={s.cardSeparator} />
    </View>
  );
}

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

  // Infinite query for discover showcase feed
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

  const showcaseItems = useMemo(() => {
    return (data?.pages.flatMap((page) => page.items) ?? []) as ShowcaseItem[];
  }, [data]);

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
      {/* 1. TOP HEADER & SEARCH & CATEGORY CHIPS */}
      <View style={[s.headerContainer, { paddingTop: insets.top + spacing.xs }]}>
        {/* Title row with circular back button */}
        <View style={s.headerTopRow}>
          <Pressable onPress={() => router.back()} style={s.circularBackBtn} testID="discover-back-btn">
            <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
          </Pressable>
          <View style={s.headerTitleCol}>
            <Text style={s.pageTitle}>Discover</Text>
            <Text style={s.pageSubtitle}>Explore newly opened shops near you</Text>
          </View>
        </View>

        {/* Pill Search Input */}
        <View style={s.pillSearchBar}>
          <Ionicons name="search" size={17} color="#7A7A7A" />
          <TextInput
            style={s.pillSearchInput}
            placeholder="Search for shops, cuisines, dishes..."
            placeholderTextColor="#8C8C8C"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
            testID="discover-search-input"
          />
          {searchQuery ? (
            <Pressable onPress={clearSearch} hitSlop={6}>
              <Ionicons name="close-circle" size={18} color="#7A7A7A" />
            </Pressable>
          ) : null}
        </View>

        {/* Category Horizontal Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.categoryChipsScroll}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCat === cat.key;
            return (
              <Pressable
                key={cat.key}
                onPress={() => setSelectedCat(cat.key)}
                style={[
                  s.categoryChip,
                  isSelected ? s.categoryChipSelected : s.categoryChipUnselected,
                ]}
                testID={`discover-cat-${cat.key}`}
              >
                <Ionicons
                  name={cat.icon}
                  size={14}
                  color={isSelected ? "#FFFFFF" : "#1A1A1A"}
                />
                <Text
                  style={[
                    s.categoryChipText,
                    isSelected ? s.categoryChipTextSelected : s.categoryChipTextUnselected,
                  ]}
                >
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 2. CONTINUOUS SCROLL FEED OF EXACT SHOP CARDS */}
      <View style={s.feedContainer}>
        {isLoading ? (
          <Loader />
        ) : isError ? (
          <ErrorState message={(error as Error)?.message || "Failed to load discovery feed"} onRetry={() => refetch()} />
        ) : (
          <FlatList
            data={showcaseItems}
            keyExtractor={(item) => item.seller.id}
            contentContainerStyle={[
              s.feedContentContainer,
              { paddingBottom: insets.bottom + spacing.xxl },
            ]}
            showsVerticalScrollIndicator={false}
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) fetchNextPage();
            }}
            onEndReachedThreshold={0.5}
            renderItem={({ item }) => (
              <ExactDiscoverShopCard
                item={item}
                onAddToCart={addToCart}
                addingPid={addingPid}
                onPreviewImage={(uri) => setPreviewImage(uri)}
              />
            )}
            ListFooterComponent={
              isFetchingNextPage ? (
                <View style={s.footerLoader}>
                  <ActivityIndicator size="small" color="#2E7D32" />
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

      {/* Full-screen Image Preview Modal */}
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

const useStyles = makeStyles(() => ({
  root: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  headerContainer: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  circularBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F2F4F5",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleCol: {
    marginLeft: 12,
    flex: 1,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111111",
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: 12,
    color: "#777777",
    marginTop: 2,
    fontWeight: "500",
  },
  pillSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingHorizontal: 14,
    height: 42,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E2E5E8",
  },
  pillSearchInput: {
    flex: 1,
    fontSize: 13,
    color: "#1A1A1A",
    paddingVertical: 0,
  },
  categoryChipsScroll: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 12,
    paddingBottom: 2,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  categoryChipSelected: {
    backgroundColor: "#2E7D32",
    borderWidth: 1,
    borderColor: "#2E7D32",
  },
  categoryChipUnselected: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  categoryChipText: {
    fontSize: 12,
  },
  categoryChipTextSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  categoryChipTextUnselected: {
    color: "#1F2937",
    fontWeight: "600",
  },
  feedContainer: {
    flex: 1,
  },
  feedContentContainer: {
    paddingTop: 12,
  },
  shopCardContainer: {
    backgroundColor: "#FFFFFF",
    marginBottom: 16,
  },
  cardSeparator: {
    height: 8,
    backgroundColor: "#F3F4F6",
    marginTop: 16,
  },

  /* 1. Hero Banner */
  heroBannerWrapper: {
    height: 240,
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#222222",
  },
  heroBannerSlide: {
    width: 360,
    height: 240,
  },
  heroBannerImage: {
    ...StyleSheet.absoluteFill,
  },
  heroTopBadges: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroTopLeftBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badgeNew: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#EA580C",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeNewText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  badgeDark: {
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeDarkText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  badgeLightPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeLightPillText: {
    color: "#111111",
    fontSize: 11,
    fontWeight: "700",
  },
  badgeVideo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeVideoText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  heroArrowLeft: {
    position: "absolute",
    left: 10,
    top: "50%",
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroArrowRight: {
    position: "absolute",
    right: 10,
    top: "50%",
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroDotsContainer: {
    position: "absolute",
    bottom: 12,
    right: 14,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
  },
  heroDot: {
    height: 6,
    borderRadius: 3,
  },
  heroDotActive: {
    width: 6,
    backgroundColor: "#4ADE80",
  },
  heroDotInactive: {
    width: 6,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
  },

  /* 2. Shop Identity Header */
  shopHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  shopLogoBox: {
    width: 62,
    height: 62,
    borderRadius: 14,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  shopLogoText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 2,
    lineHeight: 11,
  },
  shopHeaderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  shopTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  shopNameTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111111",
    flex: 1,
    letterSpacing: -0.2,
  },
  heartIconBtn: {
    padding: 2,
    marginLeft: 8,
  },
  shopCuisinesText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 3,
    fontWeight: "500",
  },
  shopMetricsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 7,
    flexWrap: "wrap",
  },
  ratingBadgeGreen: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#4CAF50",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  ratingBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  reviewsCountText: {
    fontSize: 11,
    color: "#4B5563",
    fontWeight: "500",
  },
  metricItemWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metricText: {
    fontSize: 11,
    color: "#374151",
    fontWeight: "600",
  },
  fssaiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  fssaiBadgeText: {
    fontSize: 11,
    color: "#2E7D32",
    fontWeight: "700",
  },

  /* 3. Description Block */
  descriptionBlock: {
    paddingHorizontal: 16,
    marginTop: 10,
  },
  shopDescText: {
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 18,
    fontWeight: "400",
  },
  readMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 3,
  },
  readMoreText: {
    color: "#2E7D32",
    fontSize: 12,
    fontWeight: "700",
  },

  /* 4. Action Buttons */
  actionButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 14,
    gap: 8,
  },
  actionOutlineBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    height: 38,
    borderRadius: 19,
  },
  actionOutlineBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1F2937",
  },
  directionsPillBtn: {
    flex: 1.3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "#E8F5E9",
    borderWidth: 1,
    borderColor: "#C8E6C9",
    height: 38,
    borderRadius: 19,
  },
  directionsPillBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2E7D32",
  },

  /* 5. Address Card Box */
  addressCardBox: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#F0F0F0",
    borderRadius: 14,
    padding: 12,
  },
  addressPinCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  addressInfoCol: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  addressTitleLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#111111",
  },
  addressFullText: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
    lineHeight: 15,
  },
  miniMapWrapper: {
    width: 90,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#E8F0EA",
    overflow: "hidden",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D5E6D8",
  },
  miniMapRoadH: {
    position: "absolute",
    height: 8,
    left: 0,
    right: 0,
    top: 18,
    backgroundColor: "#FFFFFF",
  },
  miniMapRoadV: {
    position: "absolute",
    width: 8,
    top: 0,
    bottom: 0,
    left: 40,
    backgroundColor: "#FFFFFF",
  },
  miniMapPinDot: {
    zIndex: 2,
  },
  mapChevron: {
    position: "absolute",
    right: 4,
    top: 17,
  },

  /* 6. Section Block (Ambience & Highlights) */
  sectionBlock: {
    marginTop: 18,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitleText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111111",
    letterSpacing: -0.2,
  },
  viewAllRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewAllGreenText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2E7D32",
  },
  ambienceScrollContainer: {
    paddingHorizontal: 16,
    gap: 10,
  },
  ambienceThumbCard: {
    width: 105,
    height: 75,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
    position: "relative",
  },
  ambienceThumbImg: {
    width: "100%",
    height: "100%",
  },
  ambienceVideoPill: {
    position: "absolute",
    bottom: 4,
    right: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  ambienceVideoText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },

  /* 7. Popular Dishes */
  dishesScrollContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  popularDishCard: {
    width: 135,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  popularDishImg: {
    width: "100%",
    height: 85,
    backgroundColor: "#F3F4F6",
  },
  popularDishContent: {
    padding: 8,
  },
  popularDishName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111111",
  },
  popularDishPrice: {
    fontSize: 12,
    fontWeight: "800",
    color: "#D97706",
    marginTop: 3,
  },
  popularDishAddBtn: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderWidth: 1,
    borderColor: "#C8E6C9",
    backgroundColor: "#F1F8F2",
    paddingVertical: 4,
    borderRadius: 8,
  },
  popularDishAddText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#2E7D32",
  },

  /* 8. Shop CTA */
  shopCtaWrapper: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  exploreShopBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#2E7D32",
    height: 44,
    borderRadius: 10,
  },
  exploreShopBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  footerLoader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 12,
    color: "#777777",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCloseBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  modalImage: {
    width: "100%",
    height: "80%",
  },
}));
