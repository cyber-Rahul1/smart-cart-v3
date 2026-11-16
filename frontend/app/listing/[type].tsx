import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated as RNAnimated,
  Dimensions,
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
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolate,
} from "react-native-reanimated";

import { api, ApiError } from "@/src/api";
import { rupee, mediaUri } from "@/src/format";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Address, DiscoverResponse, Product, Seller, ShowcaseItem } from "@/src/types";
import { AppImage, EmptyState, ErrorState, Header, IconName, Ionicons, Loader, SkeletonBlock, useToast, VegMark } from "@/src/ui";
import { AnimatedPlaceholder } from "@/src/components/animated-placeholder";
import { VegToggle } from "@/src/components/veg-toggle";
import { VoiceSearchModal } from "@/src/components/voice-search-modal";
import { FoodSkeleton } from "@/src/components/food-skeleton";
import { DiscoverSkeleton } from "@/src/components/discover-skeleton";
import ProductDetailModal from "@/src/components/product-detail-modal";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useTabBarVisibility } from "@/src/context/tab-bar-visibility";
import { BrandFooter } from "@/src/components/brand-footer";
import { FloatingCartBar } from "@/src/components/floating-cart-bar";
import { useCartSummary } from "@/src/cart";

const TITLES: Record<string, [string, string]> = {
  food: ["Food", "Restaurants & cloud kitchens near you"],
  grocery: ["Groceries", "Kirana, fresh produce & dairy"],
  new: ["Discover", "Explore newly opened shops near you"],
};

/** Shop card with preview items for generic food/grocery listing */
function ShopWithItemsCard({
  seller,
  onAddToCart,
  onChangeQty,
  qtyOf,
  onProductPress,
  addingPid,
  vegOnly = false,
}: {
  seller: Seller;
  onAddToCart: (p: Product) => void;
  onChangeQty: (p: Product, qty: number) => void;
  qtyOf: (pid: string) => number;
  onProductPress?: (p: Product, s: Seller) => void;
  addingPid: string | null;
  vegOnly?: boolean;
}) {
  const { colors } = useTheme();

  const productsQuery = useQuery({
    queryKey: ["seller-products", seller.id],
    queryFn: () => api<{ seller: Seller; products: Product[] }>(`/sellers/${seller.id}`),
    staleTime: 60000,
  });

  const rawProducts = productsQuery.data?.products ?? [];
  const products = vegOnly ? rawProducts.filter((p) => p.veg) : rawProducts;

  return (
    <View
      style={{
        marginBottom: spacing.xs,
      }}
    >
      {/* 1. CLEAN SHOP HEADER (No box background or border) */}
      <View
        style={{
          paddingHorizontal: spacing.md,
          backgroundColor: "transparent",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: spacing.xs,
            paddingBottom: 4,
          }}
        >
          {/* Shop Avatar & Name info */}
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: spacing.sm }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                overflow: "hidden",
                borderWidth: 1.5,
                borderColor: colors.border,
                backgroundColor: colors.surfaceTertiary,
              }}
            >
              <AppImage
                source={{ uri: mediaUri(seller.image) }}
                fallbackType={seller.category === "grocery" ? "groceries" : "shop"}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            </View>

            <View style={{ marginLeft: 10, flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text
                  style={{
                    fontSize: font.lg + 1,
                    fontWeight: "900",
                    color: colors.onSurface,
                    letterSpacing: -0.2,
                  }}
                  numberOfLines={1}
                >
                  {seller.name}
                </Text>
                {seller.is_new && (
                  <View
                    style={{
                      backgroundColor: "#FFF8E1",
                      borderWidth: 1,
                      borderColor: "#FFE082",
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ fontSize: 9, fontWeight: "800", color: "#FF8F00", letterSpacing: 0.3 }}>
                      NEW
                    </Text>
                  </View>
                )}
              </View>

              <Text
                style={{
                  fontSize: font.sm,
                  color: colors.muted,
                  marginTop: 1,
                  fontWeight: "500",
                }}
                numberOfLines={1}
              >
                {seller.cuisine || (seller.category === "grocery" ? "Kirana & Essentials" : "Fast Food & Meals")}
              </Text>
            </View>
          </View>

          {/* Rating badge */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#2E7D32",
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 6,
              gap: 3,
            }}
          >
            <Ionicons name="star" size={11} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontWeight: "900", fontSize: 11 }}>
              {seller.rating ? seller.rating.toFixed(1) : "4.2"}
            </Text>
          </View>
        </View>

        {/* Delivery / Distance info snippet */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingVertical: 4,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Ionicons name="time-outline" size={12} color={colors.muted} />
            <Text style={{ fontSize: font.sm - 1, color: colors.muted, fontWeight: "600" }}>
              {seller.eta_min || 25} mins
            </Text>
          </View>
          <Text style={{ color: colors.border, fontSize: font.sm - 2 }}>•</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Ionicons name="location-outline" size={12} color={colors.muted} />
            <Text style={{ fontSize: font.sm - 1, color: colors.muted, fontWeight: "600" }}>
              {seller.distance_km || 1.8} km
            </Text>
          </View>
          {seller.offer && (
            <>
              <Text style={{ color: colors.border, fontSize: font.sm - 2 }}>•</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Ionicons name="pricetag" size={11} color="#E65100" />
                <Text style={{ fontSize: font.sm - 1, color: "#E65100", fontWeight: "800" }}>
                  {seller.offer}
                </Text>
              </View>
            </>
          )}

          {/* View Menu / Store link */}
          <Pressable
            onPress={() => router.push(`/seller/${seller.id}`)}
            style={{
              marginLeft: "auto",
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 2,
              paddingHorizontal: 4,
            }}
            hitSlop={8}
          >
            <Text
              style={{
                fontSize: font.sm,
                fontWeight: "800",
                color: "#EA580C",
              }}
            >
              View store
            </Text>
            <Ionicons name="chevron-forward" size={14} color="#EA580C" />
          </Pressable>
        </View>
      </View>

      {/* 2. FREE HORIZONTAL SCROLLING DISHES (OUTSIDE OF THE CARD) */}
      {productsQuery.isLoading ? (
        <View style={{ height: 210, flexDirection: "row", paddingHorizontal: spacing.md, gap: spacing.md, alignItems: "center" }}>
          <SkeletonBlock width={140} height={180} borderRadius={16} />
          <SkeletonBlock width={140} height={180} borderRadius={16} />
          <SkeletonBlock width={140} height={180} borderRadius={16} />
        </View>
      ) : products.length === 0 ? (
        <Pressable
          onPress={() => router.push(`/seller/${seller.id}`)}
          style={{
            marginHorizontal: spacing.md,
            marginTop: spacing.md,
            height: 90,
            borderRadius: radius.md,
            backgroundColor: colors.surfaceSecondary,
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
          }}
        >
          <Ionicons name="restaurant-outline" size={24} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: font.sm, fontWeight: "600" }}>
            Tap to view available items from this shop
          </Text>
        </Pressable>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          contentContainerStyle={{
            paddingHorizontal: spacing.md,
            paddingTop: spacing.xs,
            paddingBottom: spacing.sm,
            gap: spacing.md,
          }}
        >
          {products.slice(0, 8).map((p) => {
            const isAdding = addingPid === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => onProductPress?.(p, seller)}
                style={{
                  width: 144,
                  backgroundColor: "transparent",
                }}
              >
                {/* Clean image thumbnail with floating ADD button */}
                <View
                  style={{
                    width: 144,
                    height: 130,
                    borderRadius: 12,
                    overflow: "hidden",
                    backgroundColor: colors.surfaceTertiary,
                    position: "relative",
                  }}
                >
                  <AppImage
                    source={{ uri: mediaUri(p.image || seller.image) }}
                    fallbackType={seller.category === "grocery" ? "groceries" : "food"}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={200}
                  />

                  {/* Floating ADD or Stepper button placed over bottom of image */}
                  {(() => {
                    const itemQty = qtyOf(p.id);
                    if (itemQty > 0) {
                      return (
                        <View
                          style={{
                            position: "absolute",
                            bottom: 6,
                            alignSelf: "center",
                            backgroundColor: "#FFFFFF",
                            borderWidth: 1,
                            borderColor: "rgba(252, 128, 25, 0.4)",
                            borderRadius: radius.pill,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            height: 28,
                            paddingHorizontal: 6,
                            minWidth: 80,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.15,
                            shadowRadius: 4,
                            elevation: 3,
                          }}
                        >
                          <Pressable
                            disabled={isAdding}
                            hitSlop={8}
                            onPress={(e) => {
                              e.stopPropagation();
                              onChangeQty(p, itemQty - 1);
                            }}
                            style={{ width: 22, height: 24, alignItems: "center", justifyContent: "center" }}
                          >
                            <Ionicons name="remove" size={14} color="#EA580C" />
                          </Pressable>
                          <Text style={{ fontWeight: "900", color: "#EA580C", fontSize: 12, minWidth: 16, textAlign: "center" }}>
                            {itemQty}
                          </Text>
                          <Pressable
                            disabled={isAdding}
                            hitSlop={8}
                            onPress={(e) => {
                              e.stopPropagation();
                              onChangeQty(p, itemQty + 1);
                            }}
                            style={{ width: 22, height: 24, alignItems: "center", justifyContent: "center" }}
                          >
                            <Ionicons name="add" size={14} color="#EA580C" />
                          </Pressable>
                        </View>
                      );
                    }

                    return (
                      <Pressable
                        disabled={isAdding}
                        onPress={(e) => {
                          e.stopPropagation();
                          onAddToCart(p);
                        }}
                        style={({ pressed }) => [
                          {
                            position: "absolute",
                            bottom: 6,
                            alignSelf: "center",
                            backgroundColor: "#FFFFFF",
                            borderWidth: 1,
                            borderColor: "rgba(252, 128, 25, 0.4)",
                            borderRadius: radius.pill,
                            paddingHorizontal: 16,
                            paddingVertical: 4,
                            minWidth: 68,
                            alignItems: "center",
                            justifyContent: "center",
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.15,
                            shadowRadius: 4,
                            elevation: 3,
                          },
                          pressed && { transform: [{ scale: 0.94 }] },
                        ]}
                      >
                        {isAdding ? (
                          <SkeletonBlock width={32} height={14} borderRadius={7} />
                        ) : (
                          <Text
                            style={{
                              color: "#EA580C",
                              fontWeight: "900",
                              fontSize: 12,
                              letterSpacing: 0.4,
                            }}
                          >
                            ADD
                          </Text>
                        )}
                      </Pressable>
                    );
                  })()}
                </View>

                {/* Dish name & details */}
                <View style={{ paddingTop: 6, paddingHorizontal: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <VegMark veg={p.veg} />
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: font.sm,
                        fontWeight: "700",
                        color: colors.onSurface,
                        flex: 1,
                      }}
                    >
                      {p.name}
                    </Text>
                  </View>

                  <Text
                    style={{
                      fontSize: font.sm,
                      fontWeight: "800",
                      color: colors.onSurface,
                      marginTop: 2,
                    }}
                  >
                    {rupee(p.price)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

/** Filter chips matching reference design */
const CATEGORIES: { key: string; label: string; icon: IconName }[] = [
  { key: "new", label: "Newly Opened", icon: "sparkles" },
  { key: "recently_registered", label: "Recently Registered", icon: "business-outline" },
  { key: "food", label: "Food", icon: "restaurant-outline" },
  { key: "grocery", label: "Groceries", icon: "basket-outline" },
];

/** Full Discover Shop Card matching the screenshot design */
function ExactDiscoverShopCard({
  item,
  isActive = false,
  onAddToCart,
  addingPid,
  onPreviewImage,
}: {
  item: ShowcaseItem;
  isActive?: boolean;
  onAddToCart: (p: Product, s: Seller) => void;
  addingPid: string | null;
  onPreviewImage: (uri: string) => void;
}) {
  const { seller, banner_url, gallery, description, products } = item;
  const toast = useToast();
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [bannerWidth, setBannerWidth] = useState(Dimensions.get("window").width - 32);
  const [userInteracting, setUserInteracting] = useState(false);
  const bannerScrollRef = useRef<any>(null);
  const progressAnim = useRef(new RNAnimated.Value(0)).current;

  const activeBannerIdxRef = useRef(0);
  const bannerWidthRef = useRef(bannerWidth);
  const userInteractingRef = useRef(false);
  const isActiveRef = useRef(isActive);

  activeBannerIdxRef.current = activeBannerIdx;
  bannerWidthRef.current = bannerWidth;
  userInteractingRef.current = userInteracting;
  isActiveRef.current = isActive;

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

  const hasMultiple = bannerImages.length > 1;
  const CAROUSEL_DURATION = 3500;

  // Keep banner scroll aligned when width changes
  useEffect(() => {
    if (bannerWidth > 0 && activeBannerIdxRef.current > 0) {
      bannerScrollRef.current?.scrollTo({ x: activeBannerIdxRef.current * bannerWidth, animated: false });
    }
  }, [bannerWidth]);

  // Automatic carousel sliding animation - only runs when card is active / visible on screen
  useEffect(() => {
    if (!hasMultiple) return;

    if (!isActive || userInteracting) {
      progressAnim.stopAnimation();
      progressAnim.setValue(0);
      return;
    }

    progressAnim.setValue(0);
    const anim = RNAnimated.timing(progressAnim, {
      toValue: 1,
      duration: CAROUSEL_DURATION,
      useNativeDriver: false,
    });

    anim.start(({ finished }) => {
      if (finished && isActiveRef.current && !userInteractingRef.current) {
        const next = (activeBannerIdxRef.current + 1) % bannerImages.length;
        setActiveBannerIdx(next);
        const w = bannerWidthRef.current;
        if (w > 0) {
          bannerScrollRef.current?.scrollTo({ x: next * w, animated: true });
        }
      }
    });

    return () => {
      anim.stop();
    };
  }, [hasMultiple, isActive, userInteracting, activeBannerIdx, bannerImages.length, progressAnim]);

  const fullDescription =
    description ||
    seller.description ||
    "Authentic Biryani, meals and homely Indian dishes made with fresh & quality ingredients.";

  // Ambience gallery items (4 items: 3 thumbnails + 1 "+5 More" overlay card)
  const ambienceImages = useMemo(() => {
    const fallbackList = [
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=70",
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=70",
      "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=70",
      "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=70",
    ];
    const list: string[] = [];
    if (gallery && gallery.length > 0) {
      gallery.forEach((g) => {
        if (!list.includes(g)) list.push(g);
      });
    }
    fallbackList.forEach((fb) => {
      if (list.length < 4 && !list.includes(fb)) list.push(fb);
    });
    return list.slice(0, 4);
  }, [gallery]);

  // Format reviews count
  const reviewCountDisplay = seller.reviews_count
    ? `${(seller.reviews_count / 1000).toFixed(1)}k`
    : "1.2k";

  // Formatted address lines matching screenshot:
  // line 1: "Koramangala 5th block,"
  // line 2: "Visakhapatnam, Andhra Pradesh - 530017"
  const addressLine1 = (seller.address || "Koramangala 5th block").split(",")[0].trim() + ",";
  const addressLine2 = "Visakhapatnam, Andhra Pradesh - 530017";

  const handleCall = () => {
    const phone = seller.phone || "+919876543210";
    Linking.openURL(`tel:${phone}`).catch(() => toast("Unable to open dialer", "err"));
  };

  const handleDirections = () => {
    const query = encodeURIComponent(`${seller.name}, ${seller.address || "Visakhapatnam"}`);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`).catch(() =>
      toast("Unable to open Google Maps", "err")
    );
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (bannerWidth <= 0) return;
    const offset = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offset / bannerWidth);
    setActiveBannerIdx(idx);
    setUserInteracting(false);
  };

  return (
    <View style={discoverCardStyles.cardContainer} testID={`discover-shop-${seller.id}`}>
      {/* Backdrop blur layer for liquid glass */}
      <BlurView
        intensity={24}
        tint="light"
        style={StyleSheet.absoluteFill}
      />

      {/* Blush-pink liquid glass gradient tint */}
      <LinearGradient
        colors={[
          "rgba(255, 255, 255, 0.88)",
          "rgba(255, 240, 245, 0.60)",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Specular glass highlight reflection along top edge */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 16,
          right: 16,
          height: 1,
          backgroundColor: "rgba(255, 255, 255, 0.95)",
        }}
      />

      {/* 1. HERO BANNER WITH ROUNDED CORNERS, TOP BADGES, HEART & CAROUSEL */}
      <View
        style={discoverCardStyles.heroBannerWrapper}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && Math.abs(w - bannerWidth) > 1) {
            setBannerWidth(w);
          }
        }}
      >
        <ScrollView
          ref={bannerScrollRef}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScrollBeginDrag={() => setUserInteracting(true)}
          onMomentumScrollEnd={onMomentumScrollEnd}
        >
          {bannerImages.map((imgUri, i) => (
            <View key={`hero-${i}`} style={{ width: bannerWidth > 0 ? bannerWidth : 360, height: 210, overflow: "hidden" }}>
              <Image source={{ uri: mediaUri(imgUri) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
            </View>
          ))}
        </ScrollView>

        {/* Top Badges Row: New pill, Cloud Kitchen pill, Heart Outline */}
        <View style={discoverCardStyles.heroTopBadges}>
          <View style={discoverCardStyles.heroTopLeftBadges}>
            {/* New Badge */}
            <View style={discoverCardStyles.badgeNew}>
              <Ionicons name="sparkles" size={11} color="#FFFFFF" />
              <Text style={discoverCardStyles.badgeNewText}>New</Text>
            </View>

            {/* Cloud Kitchen Badge */}
            <View style={discoverCardStyles.badgeCloudKitchen}>
              <Ionicons name="restaurant-outline" size={13} color="#6D28D9" />
              <Text style={discoverCardStyles.badgeCloudKitchenText}>Cloud Kitchen</Text>
            </View>
          </View>

          {/* Top Right: Save icon without background (matching home page full-width cards) */}
          <Pressable
            hitSlop={10}
            onPress={() => {
              setIsSaved(!isSaved);
              toast(isSaved ? "Removed from saved" : "Saved to your list");
            }}
            style={discoverCardStyles.saveBtn}
          >
            {!isSaved ? (
              <View style={{ width: 22, height: 22, alignItems: "center", justifyContent: "center" }}>
                <Ionicons
                  name="bookmark"
                  size={20}
                  color="rgba(0, 0, 0, 0.18)"
                  style={StyleSheet.absoluteFill}
                />
                <Ionicons name="bookmark-outline" size={22} color="#FFFFFF" />
              </View>
            ) : (
              <Ionicons name="bookmark" size={22} color="#F43F5E" />
            )}
          </Pressable>
        </View>

        {/* Bottom Left Video Badge (0:20) */}
        <View style={discoverCardStyles.badgeVideoBottomLeft}>
          <Ionicons name="play" size={10} color="#FFFFFF" />
          <Text style={discoverCardStyles.badgeVideoText}>0:20</Text>
        </View>

        {/* Bottom Right Carousel Pagination Dots */}
        {hasMultiple ? (
          <View style={discoverCardStyles.heroDotsContainer} pointerEvents="none">
            {bannerImages.map((_, i) => {
              const isCurrent = i === activeBannerIdx;
              return isCurrent ? (
                <View key={`dot-${i}`} style={discoverCardStyles.activeDotTrack}>
                  <RNAnimated.View
                    style={[
                      discoverCardStyles.activeDotFill,
                      {
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0%", "100%"],
                        }),
                      },
                    ]}
                  />
                </View>
              ) : (
                <View key={`dot-${i}`} style={discoverCardStyles.inactiveRoundDot} />
              );
            })}
          </View>
        ) : null}
      </View>

      {/* 2. IDENTITY HEADER ROW: Logo, Name, FSSAI Verified, Cuisines, Rating, View Menu Button */}
      <View style={discoverCardStyles.identityRow}>
        {/* Black Square Logo */}
        <View style={discoverCardStyles.shopLogoBox}>
          <Ionicons name="restaurant-outline" size={24} color="#FFFFFF" />
          <Text style={discoverCardStyles.shopLogoText}>Test{"\n"}Kitchen</Text>
        </View>

        {/* Shop Name, Verified badge & Cuisines */}
        <View style={discoverCardStyles.identityInfoCol}>
          <View style={discoverCardStyles.nameVerifiedRow}>
            <Text style={discoverCardStyles.shopNameTitle} numberOfLines={1}>
              {seller.name}
            </Text>
            <View style={discoverCardStyles.fssaiVerifiedBadge}>
              <Ionicons name="checkmark-circle" size={12} color="#15803D" />
              <Text style={discoverCardStyles.fssaiVerifiedText}>FSSAI Verified</Text>
            </View>
          </View>

          {/* Cuisines */}
          <Text style={discoverCardStyles.cuisinesText} numberOfLines={1}>
            {seller.cuisine || "Biryani  •  Indian  •  Meals"}
          </Text>

          {/* Rating Pill + Review Count */}
          <View style={discoverCardStyles.ratingRow}>
            <View style={discoverCardStyles.ratingBadgeGreen}>
              <Ionicons name="star" size={10} color="#FFFFFF" />
              <Text style={discoverCardStyles.ratingBadgeText}>{seller.rating ? seller.rating.toFixed(1) : "4.0"}</Text>
            </View>
            <Text style={discoverCardStyles.reviewsCountText}>({reviewCountDisplay} reviews)</Text>
          </View>
        </View>

        {/* View Menu > Pill Button on Right */}
        <Pressable
          style={discoverCardStyles.viewMenuBtn}
          onPress={() => router.push(`/seller/${seller.id}`)}
          testID={`discover-view-menu-${seller.id}`}
        >
          <Text style={discoverCardStyles.viewMenuBtnText}>View Menu</Text>
          <Ionicons name="chevron-forward" size={13} color="#F43F5E" />
        </Pressable>
      </View>

      {/* 3. DESCRIPTION TEXT */}
      <View style={discoverCardStyles.descriptionBox}>
        <Text style={discoverCardStyles.descText} numberOfLines={2}>
          {fullDescription}
        </Text>
      </View>

      {/* 4. METRICS ROW: Time | Distance | Delivery Fee + Info Icon */}
      <View style={discoverCardStyles.metricsRow}>
        <View style={discoverCardStyles.metricItem}>
          <Ionicons name="time-outline" size={14} color="#6B7280" />
          <Text style={discoverCardStyles.metricText}>{seller.eta_min || 36} mins</Text>
        </View>
        <View style={discoverCardStyles.metricDivider} />
        <View style={discoverCardStyles.metricItem}>
          <Ionicons name="location-outline" size={14} color="#6B7280" />
          <Text style={discoverCardStyles.metricText}>{seller.distance_km || 1.5} km</Text>
        </View>
        <View style={discoverCardStyles.metricDivider} />
        <View style={discoverCardStyles.metricItem}>
          <Ionicons name="bicycle-outline" size={15} color="#6B7280" />
          <Text style={discoverCardStyles.metricText}>₹30 delivery</Text>
          <Ionicons name="information-circle-outline" size={14} color="#9CA3AF" />
        </View>
      </View>

      {/* 5. ADDRESS & CALL / DIRECTIONS SECTION (Split box layout) */}
      <View style={discoverCardStyles.addressSectionRow}>
        {/* Left: Address with Rose Location Pin */}
        <View style={discoverCardStyles.addressCol}>
          <View style={discoverCardStyles.addressPinWrap}>
            <Ionicons name="location-sharp" size={15} color="#F43F5E" />
          </View>
          <View style={discoverCardStyles.addressTextCol}>
            <Text style={discoverCardStyles.addressHeading}>Address</Text>
            <Text style={discoverCardStyles.addressLineText} numberOfLines={1}>
              {addressLine1}
            </Text>
            <Text style={discoverCardStyles.addressLineText} numberOfLines={1}>
              {addressLine2}
            </Text>
          </View>
        </View>

        {/* Vertical divider */}
        <View style={discoverCardStyles.addressVerticalDivider} />

        {/* Right: Call & Directions Pill */}
        <View style={discoverCardStyles.contactCol}>
          <Pressable style={discoverCardStyles.callRow} onPress={handleCall}>
            <Ionicons name="call-outline" size={14} color="#4B5563" />
            <View>
              <Text style={discoverCardStyles.callLabel}>Call</Text>
              <Text style={discoverCardStyles.callNumber}>+91 98765 43210</Text>
            </View>
          </Pressable>

          <Pressable style={discoverCardStyles.directionsBtn} onPress={handleDirections}>
            <Ionicons name="navigate" size={12} color="#F43F5E" />
            <Text style={discoverCardStyles.directionsBtnText}>Directions</Text>
          </Pressable>
        </View>
      </View>

      {/* 6. AMBIENCE 4-IMAGE ROW (3 Photos + 1 "+5 More" Dark Overlay) */}
      <View style={discoverCardStyles.ambienceImagesRow}>
        {ambienceImages.map((uri, idx) => {
          if (idx === 3) {
            return (
              <Pressable
                key={`amb-${seller.id}-${idx}`}
                onPress={() => onPreviewImage(uri)}
                style={discoverCardStyles.ambienceThumb}
              >
                <Image source={{ uri: mediaUri(uri) }} style={StyleSheet.absoluteFill} contentFit="cover" />
                <View style={discoverCardStyles.morePhotosOverlay}>
                  <Text style={discoverCardStyles.morePhotosCount}>+5</Text>
                  <Text style={discoverCardStyles.morePhotosLabel}>More</Text>
                </View>
              </Pressable>
            );
          }
          return (
            <Pressable
              key={`amb-${seller.id}-${idx}`}
              onPress={() => onPreviewImage(uri)}
              style={discoverCardStyles.ambienceThumb}
            >
              <Image source={{ uri: mediaUri(uri) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function DiscoverScreen({ forcedType }: { forcedType?: string } = {}) {
  const params = useLocalSearchParams<{ type?: string; schedule?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useStyles();
  const qc = useQueryClient();
  const toast = useToast();

  const activeType = forcedType || params.type;
  const isScheduleMode = !!params.schedule;
  const isFoodMode = activeType === "food";
  const isGroceryMode = activeType === "grocery";
  const isListViewMode = isScheduleMode || isFoodMode || isGroceryMode;
  const isDiscoverMode = !params.schedule && (!activeType || activeType === "new");

  const [vegOnly, setVegOnly] = useState(false);
  const [foodCuisineFilter, setFoodCuisineFilter] = useState<string>("All");
  const stickyChipsProgress = useSharedValue(0);
  const foodCategorySectionY = useRef(150);
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const { tabBarTranslateY } = useTabBarVisibility();

  const collapseProgress = useSharedValue(0);
  const [titleRowHeight, setTitleRowHeight] = useState(56);
  const lastScrollY = useRef(0);
  const isHiddenRef = useRef(false);
  const accumulatedDiff = useRef(0);

  const TIMING_CONFIG = {
    duration: 300,
    easing: Easing.out(Easing.cubic),
  };

  const handleListingScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentY = e.nativeEvent.contentOffset.y;
    const diff = currentY - lastScrollY.current;

    // Reveal sticky category chips when scrolling down past the inline category section
    const triggerY = Math.max(100, foodCategorySectionY.current - 60);
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
      if (isHiddenRef.current) {
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

      // Hysteresis threshold: requires intentional, sustained drag (>= 50px) before flipping
      if (accumulatedDiff.current > 50 && currentY > 80) {
        // User is intentionally scrolling content UP -> hide header & bottom tab bar
        if (!isHiddenRef.current) {
          isHiddenRef.current = true;
          collapseProgress.value = withTiming(1, TIMING_CONFIG);
          tabBarTranslateY.value = withTiming(100, TIMING_CONFIG);
        }
      } else if (accumulatedDiff.current < -50) {
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
    const totalShift = titleRowHeight + spacing.xs;
    return {
      marginTop: -collapseProgress.value * totalShift,
      opacity: 1 - collapseProgress.value,
    };
  });

  const stickyChipsAnimStyle = useAnimatedStyle(() => {
    return {
      maxHeight: interpolate(stickyChipsProgress.value, [0, 1], [0, 48]),
      opacity: stickyChipsProgress.value,
      transform: [
        { translateY: interpolate(stickyChipsProgress.value, [0, 1], [-20, 0]) },
      ],
      pointerEvents: stickyChipsProgress.value > 0.5 ? ("auto" as const) : ("none" as const),
    };
  });

  const listCategory = activeType || "food";
  const categoryQuery = useQuery({
    queryKey: ["sellers", listCategory],
    queryFn: () => api<Seller[]>(`/sellers?category=${listCategory}`),
    enabled: isListViewMode,
  });
  const [listTitle, listSub] = TITLES[listCategory] ?? ["Shops", ""];

  // Default filter matches the screenshot: "Newly Opened"
  const [selectedCat, setSelectedCat] = useState<string>("new");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [addingPid, setAddingPid] = useState<string | null>(null);
  const [visibleShopId, setVisibleShopId] = useState<string | null>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: any; isViewable: boolean }> }) => {
      if (viewableItems && viewableItems.length > 0) {
        // Pick the top visible item with an id
        const top = viewableItems.find((v) => v.isViewable && v.item?.seller?.id) || viewableItems[0];
        if (top?.item?.seller?.id) {
          setVisibleShopId(top.item.seller.id);
        }
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 45,
  }).current;

  // User addresses for the location pill in the top header
  const addrQuery = useQuery({
    queryKey: ["addresses"],
    queryFn: () => api<Address[]>("/addresses"),
    enabled: isDiscoverMode,
  });
  const defaultAddress = addrQuery.data?.find((a) => a.is_default);

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

  const totalShopsCount = data?.pages?.[0]?.total ?? 32;

  const { items: cartSummaryItems, totalCount: cartCount } = useCartSummary();
  const qtyOf = (pid: string) => cartSummaryItems.find((i) => i.product_id === pid)?.qty ?? 0;

  const addToCart = async (product: Product, seller: Seller, qty: number = 1) => {
    setAddingPid(product.id);
    try {
      await api("/cart/items", { method: "POST", body: { product_id: product.id, qty } });
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

  const changeQty = async (product: Product, seller: Seller, qty: number) => {
    setAddingPid(product.id);
    try {
      await api("/cart/items", { method: "POST", body: { product_id: product.id, qty, replace: true } });
      qc.invalidateQueries({ queryKey: ["cart"] });
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 409) {
        toast("Cart contains items from another shop. Clear cart first or open shop.", "err");
      } else {
        toast(e.message || "Could not update item", "err");
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
      <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
        {/* Background Graphic matching Home Screen */}
        <Image
          source={require("@/assets/images/gathr_home_bg.jpg")}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          priority="high"
        />

        {/* Sticky Top Header */}
        <View
          style={{
            position: "relative",
            zIndex: 10,
            overflow: "hidden",
            borderBottomWidth: 0,
            backgroundColor: "transparent",
          }}
        >
          {/* Collapsible Section ABOVE search: Back button, Title & Subtitle */}
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
              testID="listing-back-button"
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
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
              <Text style={{ fontSize: font.xl, fontWeight: "900", color: colors.onSurface, letterSpacing: -0.3 }} numberOfLines={1}>
                {listTitle}
              </Text>
              {listSub ? (
                <Text style={{ fontSize: font.sm, color: colors.muted, fontWeight: "500", marginTop: 1 }} numberOfLines={1}>
                  {listSub}
                </Text>
              ) : null}
            </View>
          </Animated.View>

          {/* Sticky Search bar & Veg/Non-Veg filter row */}
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.xs,
              paddingBottom: spacing.sm,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            <Pressable
              testID="listing-search-bar"
              onPress={() => router.push(`/search?${vegOnly ? "veg=1" : ""}`)}
              style={{
                flex: 1,
                height: 46,
                borderRadius: 24,
                borderWidth: 1.2,
                borderColor: "rgba(255, 255, 255, 0.85)",
                backgroundColor: "rgba(255, 255, 255, 0.55)",
                overflow: "hidden",
                position: "relative",
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                paddingHorizontal: 16,
                shadowColor: "#F43F5E",
                shadowOpacity: 0.07,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 3 },
                elevation: 3,
              }}
            >
              {/* Backdrop blur layer for liquid glass */}
              <BlurView
                intensity={20}
                tint="light"
                style={StyleSheet.absoluteFill}
              />

              {/* Blush-pink liquid glass gradient tint */}
              <LinearGradient
                colors={[
                  "rgba(255, 255, 255, 0.65)",
                  "rgba(255, 228, 235, 0.35)",
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />

              {/* Specular glass highlight reflection along top edge */}
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 16,
                  right: 16,
                  height: 1,
                  backgroundColor: "rgba(255, 255, 255, 0.85)",
                }}
              />

              <Ionicons name="search" size={17} color="#F43F5E" />
              <View style={{ flex: 1, height: 38, justifyContent: "center", position: "relative" }}>
                <AnimatedPlaceholder
                  placeholders={[
                    "Search in " + listTitle + "...",
                    "Try 'Biryani'",
                    "Try 'Pizza'",
                    "Try 'Dosa'",
                    "Try 'Noodles'",
                    "Try 'Burger'",
                    "Try 'Sweets'",
                  ]}
                />
              </View>
              <Pressable
                onPress={() => setVoiceModalVisible(true)}
                hitSlop={8}
                style={{
                  width: 32,
                  height: 32,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: radius.pill,
                }}
              >
                <Ionicons name="mic" size={19} color="#F43F5E" />
              </Pressable>
            </Pressable>

            {/* Veg Toggle Filter */}
            <VegToggle
              value={vegOnly}
              onToggle={(val) => setVegOnly(val)}
              testID="listing-veg-toggle"
            />
          </View>

          {/* Sticky Cuisine/Category Filter Pills row in Food listing */}
          <Animated.View style={[s.stickyChipsContainer, stickyChipsAnimStyle]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.categoryPillsScroll}
              keyboardShouldPersistTaps="handled"
            >
              {[
                { key: "All", label: "All" },
                { key: "Biryani", label: "Biryani" },
                { key: "South Indian", label: "South Indian" },
                { key: "North Indian", label: "North Indian" },
                { key: "Pizza", label: "Pizza" },
                { key: "Burger", label: "Burger" },
                { key: "Chinese", label: "Chinese" },
                { key: "Desserts", label: "Desserts" },
              ].map((c) => {
                const isSelected = foodCuisineFilter === c.key;
                return (
                  <Pressable
                    key={`food-cat-${c.key}`}
                    testID={`food-cat-pill-${c.key}`}
                    onPress={() => setFoodCuisineFilter(c.key)}
                    style={({ pressed }) => [
                      s.categoryPill,
                      isSelected ? s.categoryPillActive : s.categoryPillInactive,
                      pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                    ]}
                  >
                    {!isSelected && (
                      <>
                        <BlurView intensity={18} tint="light" style={StyleSheet.absoluteFill} />
                        <LinearGradient
                          colors={["rgba(255, 255, 255, 0.90)", "rgba(255, 241, 245, 0.65)"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFill}
                        />
                      </>
                    )}
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

        {/* Schedule Delivery Mode Banner */}
        {isScheduleMode && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              marginHorizontal: spacing.lg,
              marginBottom: spacing.md,
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.pastelLilac,
            }}
          >
            <Ionicons name="time-outline" size={20} color={colors.onPastelLilac} />
            <Text style={{ fontSize: font.sm, fontWeight: "600", color: colors.onPastelLilac, flex: 1 }}>
              Ordering for future delivery • Select your items and schedule date & time at checkout
            </Text>
          </View>
        )}

        {/* Main Shops Listing */}
        {categoryQuery.isLoading ? (
          <FoodSkeleton />
        ) : categoryQuery.isError ? (
          <ErrorState
            message={(categoryQuery.error as Error)?.message || "Failed to load shops"}
            onRetry={() => categoryQuery.refetch()}
          />
        ) : (
          <Animated.FlatList
            testID={`listing-${listCategory}`}
            data={(categoryQuery.data || []).filter((s) => {
              if (foodCuisineFilter === "All") return true;
              const filterLower = foodCuisineFilter.toLowerCase();
              return (
                (s.cuisine && s.cuisine.toLowerCase().includes(filterLower)) ||
                (s.name && s.name.toLowerCase().includes(filterLower))
              );
            })}
            keyExtractor={(s) => s.id}
            onScroll={handleListingScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{
              paddingVertical: spacing.md,
              paddingBottom: insets.bottom + (cartCount > 0 ? 120 : spacing.xl),
            }}
            ListHeaderComponent={
              <View
                onLayout={(e) => {
                  foodCategorySectionY.current = e.nativeEvent.layout.y;
                }}
                style={{ paddingBottom: spacing.sm }}
              >
                {/* Inline Section Title */}
                <View style={{ paddingHorizontal: spacing.lg, marginBottom: 10 }}>
                  <Text style={{ fontSize: 18, fontWeight: "900", color: "#0F172A", letterSpacing: -0.3 }}>
                    What's on your mind?
                  </Text>
                </View>

                {/* Inline Cuisine / Category Filter Pills */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.categoryPillsScroll}
                >
                  {[
                    { key: "All", label: "All" },
                    { key: "Biryani", label: "Biryani" },
                    { key: "South Indian", label: "South Indian" },
                    { key: "North Indian", label: "North Indian" },
                    { key: "Pizza", label: "Pizza" },
                    { key: "Burger", label: "Burger" },
                    { key: "Chinese", label: "Chinese" },
                    { key: "Desserts", label: "Desserts" },
                  ].map((c) => {
                    const isSelected = foodCuisineFilter === c.key;
                    return (
                      <Pressable
                        key={`inline-food-cat-${c.key}`}
                        testID={`inline-food-cat-pill-${c.key}`}
                        onPress={() => setFoodCuisineFilter(c.key)}
                        style={({ pressed }) => [
                          s.categoryPill,
                          isSelected ? s.categoryPillActive : s.categoryPillInactive,
                          pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                        ]}
                      >
                        {!isSelected && (
                          <>
                            <BlurView intensity={18} tint="light" style={StyleSheet.absoluteFill} />
                            <LinearGradient
                              colors={["rgba(255, 255, 255, 0.90)", "rgba(255, 241, 245, 0.65)"]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={StyleSheet.absoluteFill}
                            />
                          </>
                        )}
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
              </View>
            }
            ItemSeparatorComponent={() => (
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  marginVertical: spacing.xl,
                }}
              >
                <View
                  style={{
                    width: "82%",
                    height: 1,
                    backgroundColor: colors.border,
                    opacity: 0.45,
                    borderRadius: 1,
                  }}
                />
              </View>
            )}
            renderItem={({ item }) => (
              <ShopWithItemsCard
                seller={item}
                vegOnly={vegOnly}
                onAddToCart={(p) => {
                  addToCart(p, item, 1);
                }}
                onChangeQty={(p, n) => {
                  changeQty(p, item, n);
                }}
                qtyOf={qtyOf}
                onProductPress={(p, s) => {
                  setSelectedProduct(p);
                  setSelectedSeller(s);
                }}
                addingPid={addingPid}
              />
            )}
            ListEmptyComponent={
              <EmptyState
                icon="storefront-outline"
                title="No shops nearby"
                body="We couldn't find any open shops in this category near your location."
              />
            }
            ListFooterComponent={
              categoryQuery.data && categoryQuery.data.length > 0 ? (
                <View style={{ paddingHorizontal: spacing.md }}>
                  <BrandFooter />
                </View>
              ) : undefined
            }
          />
        )}

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
          onAddToCart={(p, qty, cookingRequest) => {
            if (selectedSeller) {
              addToCart(p, selectedSeller, qty);
            }
            if (cookingRequest) {
              toast(`Note for chef: "${cookingRequest}"`);
            }
          }}
        />

        {/* Floating Cart Bar positioned cleanly above bottom tab navigation */}
        <FloatingCartBar
          bottomOffset={insets.bottom > 0 ? insets.bottom + 52 : 60}
          dockSide="left"
        />
      </View>
    );
  }

  /* ---------------- DISCOVER PAGE EXACT REDESIGN ---------------- */
  return (
    <View style={s.root}>
      {/* Background Graphic matching Home Screen */}
      <Image
        source={require("@/assets/images/gathr_home_bg.jpg")}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        priority="high"
      />

      {/* 1. TOP HEADER & SEARCH & CATEGORY CHIPS */}
      <View style={[s.headerContainer, { paddingTop: insets.top + spacing.xs }]}>
        {/* Title row with Back button on top left & Location Selector on top right */}
        <View style={s.headerTopRow}>
          {/* Back Button */}
          <Pressable
            testID="discover-back-button"
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
            style={({ pressed }) => [
              s.backBtn,
              pressed && { opacity: 0.6, transform: [{ scale: 0.95 }] },
            ]}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color="#111111" />
          </Pressable>

          <View style={s.headerTitleCol}>
            <Text style={s.pageTitle}>Discover</Text>
            <Text style={s.pageSubtitle}>Explore newly opened shops near you</Text>
          </View>

          {/* Location selector pill on top right */}
          <Pressable
            testID="discover-location-selector"
            onPress={() => router.push("/addresses")}
            style={s.locationPill}
          >
            <Ionicons name="location-sharp" size={14} color="#F43F5E" />
            <Text style={s.locationPillText} numberOfLines={1}>
              {defaultAddress?.label || "Visakhapatnam"}
            </Text>
            <Ionicons name="chevron-down" size={13} color="#4B5563" />
          </Pressable>
        </View>

        {/* Pill Search Bar with Filters Sliders Icon (Home Page Liquid Glass Style) */}
        <View style={s.pillSearchBar}>
          {/* Backdrop blur layer for liquid glass */}
          <BlurView
            intensity={20}
            tint="light"
            style={StyleSheet.absoluteFill}
          />

          {/* Blush-pink liquid glass gradient tint */}
          <LinearGradient
            colors={[
              "rgba(255, 255, 255, 0.65)",
              "rgba(255, 228, 235, 0.35)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Specular glass highlight reflection along top edge */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 16,
              right: 16,
              height: 1,
              backgroundColor: "rgba(255, 255, 255, 0.85)",
            }}
          />

          <Ionicons name="search" size={17} color="#F43F5E" />
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
          ) : (
            <View style={s.searchFilterDivider}>
              <Ionicons name="options-outline" size={18} color="#4B5563" />
            </View>
          )}
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
                  color={isSelected ? "#F43F5E" : "#1A1A1A"}
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

      {/* 2. MAIN SCROLLABLE CONTENT */}
      {isLoading ? (
        <DiscoverSkeleton />
      ) : isError ? (
        <ErrorState message={(error as Error)?.message || "Failed to load discovery feed"} onRetry={() => refetch()} />
      ) : (
        <FlatList
          data={showcaseItems}
          keyExtractor={(item) => item.seller.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: insets.bottom + 32,
          }}
          refreshing={isRefetching}
          onRefresh={() => refetch()}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: 16 }}>
              {/* Rose Liquid Glass Promo Card */}
              <View style={s.promoBannerCard}>
                <BlurView
                  intensity={25}
                  tint="light"
                  style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                  colors={["rgba(255, 255, 255, 0.85)", "rgba(255, 228, 235, 0.55)", "rgba(254, 205, 211, 0.40)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
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
                {/* Left Promo Text */}
                <View style={s.promoContentLeft}>
                  <View style={s.promoOverlineWrap}>
                    <Text style={s.promoOverline}>EXPLORE</Text>
                  </View>
                  <Text style={s.promoHeadline}>
                    Newly Opened{"\n"}
                    <Text style={{ color: "#F43F5E" }}>Shops </Text>
                    <Text style={{ color: "#F43F5E" }}>Near You</Text>
                  </Text>
                  <Text style={s.promoSubtext}>
                    Fresh listings, local favorites & cloud kitchens in your area.
                  </Text>

                  {/* Carousel pagination indicators */}
                  <View style={s.promoDotsRow}>
                    <View style={s.promoDotActive} />
                    <View style={s.promoDotInactive} />
                    <View style={s.promoDotInactive} />
                  </View>
                </View>

                {/* Right Biryani Bowl Image */}
                <View style={s.promoImageWrap}>
                  <Image
                    source={{ uri: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=70" }}
                    style={s.promoBowlImage}
                    contentFit="cover"
                  />
                </View>
              </View>

              {/* Newly Added Shops Section Header Row */}
              <View style={s.sectionHeaderRow}>
                <Text style={s.sectionHeaderTitle}>Newly Added Shops</Text>
                <Pressable style={s.viewAllRow} onPress={() => setSelectedCat("all")}>
                  <Text style={s.viewAllText}>View All ({totalShopsCount})</Text>
                  <Ionicons name="chevron-forward" size={14} color="#F43F5E" />
                </Pressable>
              </View>
            </View>
          }
          renderItem={({ item, index }) => {
            const isCardActive = visibleShopId
              ? visibleShopId === item.seller.id
              : index === 0;

            return (
              <View style={{ paddingHorizontal: 16 }}>
                <ExactDiscoverShopCard
                  item={item}
                  isActive={isCardActive}
                  onAddToCart={addToCart}
                  addingPid={addingPid}
                  onPreviewImage={(uri) => setPreviewImage(uri)}
                />
              </View>
            );
          }}
          ListFooterComponent={
            <View>
              {isFetchingNextPage ? (
                <View style={[s.footerLoader, { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm }]}>
                  <SkeletonBlock width={16} height={16} borderRadius={8} />
                  <Text style={s.footerText}>Loading more businesses...</Text>
                </View>
              ) : null}
              {showcaseItems.length > 0 && (
                <View style={{ paddingHorizontal: spacing.md }}>
                  <BrandFooter />
                </View>
              )}
            </View>
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
    backgroundColor: "transparent",
  },
  headerContainer: {
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginLeft: -4,
  },
  headerTitleCol: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111111",
    letterSpacing: -0.4,
  },
  pageSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
    fontWeight: "500",
  },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 5,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  locationPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F2937",
    maxWidth: 110,
  },
  pillSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 46,
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.85)",
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    overflow: "hidden",
    position: "relative",
    paddingHorizontal: 16,
    gap: 10,
    shadowColor: "#F43F5E",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  pillSearchInput: {
    flex: 1,
    fontSize: 13.5,
    color: "#1A1A1A",
    paddingVertical: 0,
  },
  searchFilterDivider: {
    borderLeftWidth: 1,
    borderLeftColor: "#E5E7EB",
    paddingLeft: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryChipsScroll: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 14,
    paddingBottom: 6,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  categoryChipSelected: {
    backgroundColor: "#FFF1F3",
    borderWidth: 1.5,
    borderColor: "#F43F5E",
  },
  categoryChipUnselected: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  categoryChipText: {
    fontSize: 12.5,
  },
  categoryChipTextSelected: {
    color: "#F43F5E",
    fontWeight: "700",
  },
  categoryChipTextUnselected: {
    color: "#374151",
    fontWeight: "600",
  },
  promoBannerCard: {
    marginTop: 10,
    borderRadius: 14,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    minHeight: 140,
    position: "relative",
    shadowColor: "#F43F5E",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  promoContentLeft: {
    flex: 1.1,
    paddingRight: 6,
  },
  promoOverlineWrap: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(244, 63, 94, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 6,
  },
  promoOverline: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#F43F5E",
  },
  promoHeadline: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111111",
    lineHeight: 22,
  },
  promoSubtext: {
    fontSize: 11,
    color: "#4B5563",
    marginTop: 6,
    lineHeight: 15,
  },
  promoDotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 12,
  },
  promoDotActive: {
    width: 14,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#F43F5E",
  },
  promoDotInactive: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D1D5DB",
  },
  promoImageWrap: {
    flex: 0.9,
    alignItems: "center",
    justifyContent: "center",
  },
  promoBowlImage: {
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111111",
    letterSpacing: -0.3,
  },
  viewAllRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#F43F5E",
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
  stickyChipsContainer: {
    position: "relative",
    zIndex: 5,
    overflow: "hidden",
    backgroundColor: "transparent",
    paddingBottom: spacing.xs,
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
    borderColor: "rgba(226, 232, 240, 0.8)",
    overflow: "hidden",
    position: "relative",
    shadowColor: "#F43F5E",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1.5 },
  },
  categoryPillActive: {
    backgroundColor: "#F43F5E",
    borderColor: "#F43F5E",
    shadowColor: "#F43F5E",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  categoryPillInactive: {
    backgroundColor: "transparent",
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
    color: "#334155",
    fontWeight: "700",
  },
}));

const discoverCardStyles = StyleSheet.create({
  cardContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.9)",
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#F43F5E",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    paddingBottom: 14,
  },
  heroBannerWrapper: {
    height: 210,
    position: "relative",
    backgroundColor: "#1A1A1A",
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
    gap: 8,
  },
  badgeNew: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F43F5E",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  badgeNewText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  badgeCloudKitchen: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  badgeCloudKitchenText: {
    color: "#6D28D9",
    fontSize: 11,
    fontWeight: "800",
  },
  saveBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeVideoBottomLeft: {
    position: "absolute",
    bottom: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeVideoText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  heroDotsContainer: {
    position: "absolute",
    bottom: 14,
    right: 14,
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  activeDotTrack: {
    width: 16,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    overflow: "hidden",
  },
  activeDotFill: {
    height: "100%",
    backgroundColor: "#F43F5E",
    borderRadius: 3,
  },
  inactiveRoundDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#F43F5E",
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  shopLogoBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    padding: 3,
  },
  shopLogoText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 1,
    lineHeight: 9,
  },
  identityInfoCol: {
    flex: 1,
    marginLeft: 10,
    marginRight: 6,
  },
  nameVerifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  shopNameTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111111",
    letterSpacing: -0.2,
  },
  fssaiVerifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.22)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  fssaiVerifiedText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#15803D",
  },
  cuisinesText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
    fontWeight: "500",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  ratingBadgeGreen: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#15803D",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  ratingBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  reviewsCountText: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
  },
  viewMenuBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#FFF1F3",
    borderWidth: 1,
    borderColor: "#FECDD3",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "center",
  },
  viewMenuBtnText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#F43F5E",
  },
  descriptionBox: {
    paddingHorizontal: 14,
    marginTop: 8,
  },
  descText: {
    fontSize: 12,
    color: "#4B5563",
    lineHeight: 17,
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginTop: 10,
    gap: 8,
  },
  metricItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metricText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  metricDivider: {
    width: 1,
    height: 12,
    backgroundColor: "#E5E7EB",
  },
  addressSectionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 14,
    padding: 10,
    gap: 8,
  },
  addressCol: {
    flex: 1.2,
    flexDirection: "row",
    gap: 8,
  },
  addressPinWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFF1F3",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  addressTextCol: {
    flex: 1,
  },
  addressHeading: {
    fontSize: 11,
    fontWeight: "800",
    color: "#111111",
  },
  addressLineText: {
    fontSize: 10.5,
    color: "#6B7280",
    marginTop: 1,
  },
  addressVerticalDivider: {
    width: 1,
    height: 38,
    backgroundColor: "#E5E7EB",
  },
  contactCol: {
    flex: 0.9,
    gap: 6,
    alignItems: "flex-end",
  },
  callRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  callLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#111111",
  },
  callNumber: {
    fontSize: 9.5,
    fontWeight: "600",
    color: "#4B5563",
  },
  directionsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFF1F3",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#FECDD3",
  },
  directionsBtnText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#F43F5E",
  },
  ambienceImagesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    marginTop: 12,
    gap: 6,
  },
  ambienceThumb: {
    flex: 1,
    height: 68,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
    position: "relative",
  },
  morePhotosOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  morePhotosCount: {
    fontSize: 15,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  morePhotosLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: -2,
  },
});
