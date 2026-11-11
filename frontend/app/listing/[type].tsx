import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, ApiError } from "@/src/api";
import { rupee, mediaUri } from "@/src/format";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { DiscoverResponse, Product, Seller, ShowcaseItem } from "@/src/types";
import { AppImage, EmptyState, ErrorState, Header, IconName, Ionicons, Loader, useToast, VegMark } from "@/src/ui";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { AnimatedPlaceholder } from "@/src/components/animated-placeholder";
import { VegToggle } from "@/src/components/veg-toggle";
import { VoiceSearchModal } from "@/src/components/voice-search-modal";

const TITLES: Record<string, [string, string]> = {
  food: ["Food", "Restaurants & cloud kitchens near you"],
  grocery: ["Groceries", "Kirana, fresh produce & dairy"],
  new: ["Discover", "Explore newly opened shops near you"],
};

import { LinearGradient } from "expo-linear-gradient";

/** Shop card with preview items for generic food/grocery listing */
function ShopWithItemsCard({
  seller,
  onAddToCart,
  addingPid,
  vegOnly = false,
}: {
  seller: Seller;
  onAddToCart: (p: Product) => void;
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
                borderRadius: 22,
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
                    flexShrink: 1,
                  }}
                  numberOfLines={1}
                >
                  {seller.name}
                </Text>
              </View>

              {/* Rating + Time row */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 2,
                    backgroundColor: "#16A34A",
                    borderRadius: 5,
                    paddingHorizontal: 5,
                    paddingVertical: 1.5,
                  }}
                >
                  <Ionicons name="star" size={10} color="#FFFFFF" />
                  <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "800" }}>
                    {seller.rating ? seller.rating.toFixed(1) : "4.2"}
                  </Text>
                </View>
                <Text style={{ fontSize: font.sm, color: colors.muted, fontWeight: "600" }}>
                  {seller.eta_min ? `${seller.eta_min - 5 > 0 ? seller.eta_min - 5 : 10}-${seller.eta_min} mins` : "15-20 mins"}
                </Text>
              </View>
            </View>
          </View>

          {/* View All Button Pill */}
          <Pressable
            hitSlop={8}
            onPress={() => router.push(`/seller/${seller.id}`)}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: colors.surface,
                paddingVertical: 5,
                paddingHorizontal: 12,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: "rgba(252, 128, 25, 0.25)",
              },
              pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] },
            ]}
          >
            <Text style={{ color: "#FC8019", fontWeight: "800", fontSize: font.sm + 0.5 }}>
              View All
            </Text>
            <Ionicons name="arrow-forward" size={13} color="#FC8019" />
          </Pressable>
        </View>

        {/* Promo offer strip */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            paddingTop: 3,
            paddingBottom: 2,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: "rgba(252, 128, 25, 0.1)",
              paddingHorizontal: 8,
              paddingVertical: 2.5,
              borderRadius: radius.pill,
            }}
          >
            <Ionicons name="pricetag" size={12} color="#FC8019" />
            <Text style={{ fontSize: 11, color: "#FC8019", fontWeight: "800" }}>
              {seller.offer || "50% off upto ₹100"}
            </Text>
          </View>
        </View>
      </View>

      {/* 2. FREE HORIZONTAL SCROLLING DISHES (OUTSIDE OF THE CARD) */}
      {productsQuery.isLoading ? (
        <View style={{ height: 210, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color="#FC8019" />
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
            Tap to explore full shop menu
          </Text>
        </Pressable>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.md,
            paddingTop: spacing.md,
            paddingBottom: spacing.xs,
            gap: spacing.md,
          }}
        >
          {products.slice(0, 8).map((p) => {
            const isAdding = addingPid === p.id;
            return (
              <View
                key={p.id}
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
                    borderRadius: 18,
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

                  {/* Floating ADD button placed over bottom of image like Swiggy/Zomato */}
                  <Pressable
                    disabled={isAdding}
                    onPress={() => onAddToCart(p)}
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
                      <ActivityIndicator size="small" color="#FC8019" />
                    ) : (
                      <Text
                        style={{
                          color: "#FC8019",
                          fontWeight: "900",
                          fontSize: 12,
                          letterSpacing: 0.4,
                        }}
                      >
                        ADD
                      </Text>
                    )}
                  </Pressable>
                </View>

                {/* Price & Veg mark */}
                <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <VegMark veg={p.veg} />
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "800",
                      color: colors.onSurface,
                    }}
                  >
                    {rupee(p.price)}
                  </Text>
                  {p.price ? (
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.muted,
                        textDecorationLine: "line-through",
                      }}
                    >
                      {rupee(Math.round(p.price * 1.25))}
                    </Text>
                  ) : null}
                </View>

                {/* Dish name */}
                <Text
                  numberOfLines={2}
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: colors.onSurface,
                    marginTop: 2,
                    lineHeight: 17,
                  }}
                >
                  {p.name}
                </Text>
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
  cardHeight,
  isActive = true,
  onAddToCart,
  addingPid,
  onPreviewImage,
}: {
  item: ShowcaseItem;
  cardHeight: number;
  isActive?: boolean;
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
  const [bannerWidth, setBannerWidth] = useState(Dimensions.get("window").width - 32);
  const [userInteracting, setUserInteracting] = useState(false);
  const bannerScrollRef = useRef<any>(null);
  const progressAnim = useRef(new RNAnimated.Value(0)).current;

  const activeBannerIdxRef = useRef(0);
  const bannerWidthRef = useRef(bannerWidth);
  const userInteractingRef = useRef(false);

  activeBannerIdxRef.current = activeBannerIdx;
  bannerWidthRef.current = bannerWidth;
  userInteractingRef.current = userInteracting;

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

  // Automatic carousel sliding animation with duration progress bar on active dot ONLY when isActive
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
      if (finished && isActive && !userInteractingRef.current) {
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
    "Authentic, restaurant-style Biryani and Indian meals crafted with premium spices and fresh ingredients.";

  // Words array
  const words = useMemo(() => {
    return fullDescription.trim().split(/\s+/).filter(Boolean);
  }, [fullDescription]);

  const WORD_LIMIT = 20;
  const canExpand = words.length > WORD_LIMIT;

  // When collapsed and expandable, slice to the word limit with an ellipsis
  const displayedDescription = useMemo(() => {
    if (!canExpand || isDescExpanded) {
      return fullDescription;
    }
    return words.slice(0, WORD_LIMIT).join(" ") + "...";
  }, [fullDescription, words, canExpand, isDescExpanded]);

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

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (bannerWidth <= 0) return;
    const offset = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offset / bannerWidth);
    setActiveBannerIdx(idx);
    setUserInteracting(false);
  };

  // Dynamic banner height proportionally balanced with full screen height
  const dynamicBannerHeight = cardHeight > 0 ? Math.max(220, Math.min(270, Math.round(cardHeight * 0.32))) : 240;

  return (
    <View
      style={[s.shopCardContainer, cardHeight > 0 && { height: cardHeight }]}
      testID={`discover-shop-${seller.id}`}
    >
      {/* 1. HERO BANNER WITH AUTOMATIC CAROUSEL, BADGES & DURATION PROGRESS */}
      <View
        style={[s.heroBannerWrapper, { height: dynamicBannerHeight }]}
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
            <View key={`hero-${i}`} style={{ width: bannerWidth > 0 ? bannerWidth : 360, height: dynamicBannerHeight, overflow: "hidden" }}>
              <Image source={{ uri: mediaUri(imgUri) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
            </View>
          ))}
        </ScrollView>

        {/* Top Badges Row */}
        <View style={s.heroTopBadges} pointerEvents="none">
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

        {/* Bottom Right Carousel Pagination with Duration Animation */}
        {hasMultiple ? (
          <View style={s.heroDotsContainer} pointerEvents="none">
            {bannerImages.map((_, i) => {
              const isCurrent = i === activeBannerIdx;
              return isCurrent ? (
                <View key={`dot-${i}`} style={s.activeDotTrack}>
                  <RNAnimated.View
                    style={[
                      s.activeDotFill,
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
                <View key={`dot-${i}`} style={s.inactiveRoundDot} />
              );
            })}
          </View>
        ) : null}
      </View>

      {/* Internal scrollable content so full details remain completely accessible inside the snapped card */}
      <ScrollView
        style={s.cardBodyScroll}
        contentContainerStyle={s.cardBodyScrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
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
                  toast(isSaved ? "Removed from saved" : "Saved to your list");
                }}
                style={s.saveIconBtn}
              >
                <Ionicons
                  name={isSaved ? "bookmark" : "bookmark-outline"}
                  size={22}
                  color={isSaved ? "#FC8019" : "#1A1A1A"}
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

        {/* 3. DESCRIPTION WITH CONDITIONAL "Read more" TOGGLE */}
        <View style={s.descriptionBlock}>
          <Text style={s.shopDescText}>
            {displayedDescription}
          </Text>
          {canExpand && (
            <Pressable
              hitSlop={6}
              onPress={() => setIsDescExpanded(!isDescExpanded)}
              style={s.readMoreBtn}
            >
              <Text style={s.readMoreText}>{isDescExpanded ? "Show less" : "Read more"}</Text>
              <Ionicons
                name={isDescExpanded ? "chevron-up" : "chevron-down"}
                size={14}
                color="#FC8019"
              />
            </Pressable>
          )}
        </View>

        {/* 4. ACTION BUTTONS: Call, Chat, Share, Directions (Brand filled pill) */}
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
            <Ionicons name="navigate" size={15} color="#FC8019" />
            <Text style={s.directionsPillBtnText}>Directions</Text>
          </Pressable>
        </View>

        {/* 5. ADDRESS CARD WITH MINI MAP PREVIEW */}
        <Pressable style={s.addressCardBox} onPress={handleDirections}>
          <View style={s.addressPinCircle}>
            <Ionicons name="location-sharp" size={16} color="#FC8019" />
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
              <Ionicons name="location-sharp" size={14} color="#FC8019" />
            </View>
            <Ionicons name="chevron-forward" size={14} color="#666666" style={s.mapChevron} />
          </View>
        </Pressable>

        {/* 6. SHOP AMBIENCE & HIGHLIGHTS (Horizontal Photos - View All removed per request) */}
        <View style={s.sectionBlock}>
          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionTitleText}>Shop Ambience & Highlights</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
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
              <Text style={s.viewAllOrangeText}>View all ({item.total_products || 12})</Text>
              <Ionicons name="chevron-forward" size={14} color="#FC8019" />
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
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
                        <ActivityIndicator size="small" color="#FC8019" />
                      ) : (
                        <>
                          <Ionicons name="add" size={13} color="#FC8019" />
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

        {/* Bottom space so content doesn't get obscured by fixed button */}
        <View style={{ height: 60 }} />
      </ScrollView>

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
  const isGroceryMode = params.type === "grocery";
  const isListViewMode = isScheduleMode || isFoodMode || isGroceryMode;
  const isDiscoverMode = !params.schedule && (!params.type || params.type === "new");

  const [vegOnly, setVegOnly] = useState(false);
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);

  const collapseProgress = useSharedValue(0);
  const [titleRowHeight, setTitleRowHeight] = useState(56);
  const lastScrollY = useRef(0);
  const isHiddenRef = useRef(false);

  const TIMING_CONFIG = {
    duration: 260,
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  };

  const handleListingScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentY = e.nativeEvent.contentOffset.y;
    const diff = currentY - lastScrollY.current;

    if (currentY <= 10) {
      if (isHiddenRef.current) {
        isHiddenRef.current = false;
        collapseProgress.value = withTiming(0, TIMING_CONFIG);
      }
    } else if (diff > 12 && currentY > 40) {
      // User is scrolling content UP (finger moving up) -> hide top title row
      if (!isHiddenRef.current) {
        isHiddenRef.current = true;
        collapseProgress.value = withTiming(1, TIMING_CONFIG);
      }
    } else if (diff < -12) {
      // User is scrolling content DOWN (finger moving down) -> reveal top title row immediately!
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
  const [visibleShopId, setVisibleShopId] = useState<string | null>(null);

  // Track the most visible card in the feed
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ item: any; isViewable: boolean }> }) => {
    if (viewableItems && viewableItems.length > 0) {
      const topVisible = viewableItems.find((v) => v.isViewable) || viewableItems[0];
      if (topVisible?.item?.seller?.id) {
        setVisibleShopId(topVisible.item.seller.id);
      }
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

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

          {/* Sticky Search bar & Veg/Non-Veg filter row (always visible!) */}
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: spacing.lg,
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

              {/* Vertical divider */}
              <View style={{ width: 1, height: 20, backgroundColor: "rgba(255, 128, 25, 0.15)" }} />

              {/* Voice mic option */}
              <Pressable
                testID="listing-voice-mic-button"
                onPress={(e) => {
                  e.stopPropagation();
                  setVoiceModalVisible(true);
                }}
                style={({ pressed }) => [
                  { padding: 4, alignItems: "center", justifyContent: "center" },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons name="mic" size={20} color={colors.brandPrimary} />
              </Pressable>
            </Pressable>

            {/* Veg Toggle Filter */}
            <VegToggle
              value={vegOnly}
              onToggle={(val) => setVegOnly(val)}
              testID="listing-veg-toggle"
            />
          </View>
        </View>

        {/* Voice Search Modal */}
        <VoiceSearchModal
          visible={voiceModalVisible}
          onClose={() => setVoiceModalVisible(false)}
          onTranscript={(spoken) => {
            router.push(`/search?q=${encodeURIComponent(spoken)}${vegOnly ? "&veg=1" : ""}`);
          }}
        />

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
          <Animated.FlatList
            testID={`listing-${listCategory}`}
            data={categoryQuery.data}
            keyExtractor={(s) => s.id}
            onScroll={handleListingScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{
              paddingVertical: spacing.md,
              paddingBottom: insets.bottom + spacing.xl,
            }}
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
                onAddToCart={(p) => addToCart(p, item)}
                addingPid={addingPid}
                vegOnly={vegOnly}
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
        {/* Title row with back button without background */}
        <View style={s.headerTopRow}>
          <Pressable
            onPress={() => router.back()}
            style={s.circularBackBtn}
            testID="discover-back-btn"
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
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

      {/* 2. SNAP-FITTING CONTINUOUS FEED OF EXACT SHOP CARDS */}
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
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) fetchNextPage();
            }}
            onEndReachedThreshold={0.5}
            renderItem={({ item, index }) => (
              <ExactDiscoverShopCard
                item={item}
                cardHeight={containerHeight}
                isActive={visibleShopId ? visibleShopId === item.seller.id : index === 0}
                onAddToCart={addToCart}
                addingPid={addingPid}
                onPreviewImage={(uri) => setPreviewImage(uri)}
              />
            )}
            ListFooterComponent={
              isFetchingNextPage ? (
                <View style={s.footerLoader}>
                  <ActivityIndicator size="small" color="#FC8019" />
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
    backgroundColor: "#FFFFFF",
  },
  headerContainer: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  circularBackBtn: {
    width: 36,
    height: 36,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -4,
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
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    height: 50,
    marginTop: 4,
    marginBottom: 4,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
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
    backgroundColor: "#FC8019",
    borderWidth: 1,
    borderColor: "#FC8019",
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
  shopCardContainer: {
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  cardBodyScroll: {
    flex: 1,
  },
  cardBodyScrollContent: {
    paddingBottom: 16,
  },

  /* 1. Hero Banner */
  heroBannerWrapper: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 20,
    overflow: "hidden",
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
  heroDotsContainer: {
    position: "absolute",
    bottom: 12,
    right: 14,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
  },
  activeDotTrack: {
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    overflow: "hidden",
  },
  activeDotFill: {
    height: "100%",
    backgroundColor: "#FC8019",
    borderRadius: 3,
  },
  inactiveRoundDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
  },

  /* 2. Shop Identity Header */
  shopHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 14,
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
  saveIconBtn: {
    padding: 4,
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
    marginTop: 8,
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
    color: "#FC8019",
    fontSize: 12,
    fontWeight: "700",
  },

  /* 4. Action Buttons */
  actionButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 12,
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
    backgroundColor: "#FFF0E5",
    borderWidth: 1,
    borderColor: "#FFD8BF",
    height: 38,
    borderRadius: 19,
  },
  directionsPillBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FC8019",
  },

  /* 5. Address Card Box */
  addressCardBox: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
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
    backgroundColor: "#FFF0E5",
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
    backgroundColor: "#FFF3EB",
    overflow: "hidden",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFE0CC",
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
    marginTop: 14,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
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
  viewAllOrangeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FC8019",
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
    borderColor: "#FFD8BF",
    backgroundColor: "#FFF8F2",
    paddingVertical: 4,
    borderRadius: 8,
  },
  popularDishAddText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FC8019",
  },

  /* 8. Shop CTA */
  shopCtaWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 8,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  exploreShopBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FC8019",
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
