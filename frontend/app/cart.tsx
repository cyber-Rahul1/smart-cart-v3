import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AddressPicker, useAddresses } from "@/src/components/address-picker";
import { rupee } from "@/src/format";
import { usesNativeTabs } from "@/src/navigation";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Address } from "@/src/types";
import { BillRow, Button, Chip, ChipRow, EmptyState, ErrorState, Ionicons, Loader, Stepper, useToast, VegMark } from "@/src/ui";
import { CartQuoteResponse, CartStoreGroup, CouponItem, applyOptimisticCartItem } from "@/src/cart";
import { CartSkeleton } from "@/src/components/cart-skeleton";

const SCHEDULES = [
  { key: "now", label: "Instant (25-30 mins)", icon: "flash-outline" },
  { key: "1h", label: "In 1 hour", icon: "time-outline" },
  { key: "2h", label: "In 2 hours", icon: "time-outline" },
  { key: "tonight", label: "Tonight 8 PM", icon: "moon-outline" },
  { key: "tomorrow", label: "Tomorrow 9 AM", icon: "sunny-outline" },
] as const;

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const { user, refresh } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState<string | null>(null);
  const [useCredit, setUseCredit] = useState(false);
  const [schedule, setSchedule] = useState<(typeof SCHEDULES)[number]["key"]>("now");
  const [addr, setAddr] = useState<Address | null>(null);
  const [picker, setPicker] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [couponExpanded, setCouponExpanded] = useState(false);
  // Store collapsed states by seller.id
  const [collapsedStores, setCollapsedStores] = useState<Record<string, boolean>>({});
  // Special instructions & cutlery preference per seller
  const [storeNotes, setStoreNotes] = useState<Record<string, string>>({});
  const [noCutlery, setNoCutlery] = useState<Record<string, boolean>>({});
  const [editingNoteSeller, setEditingNoteSeller] = useState<string | null>(null);
  const [tempNoteText, setTempNoteText] = useState("");

  const addresses = useAddresses();
  const bottomChrome = insets.bottom > 0 ? insets.bottom : spacing.sm;

  const q = useQuery({
    queryKey: ["cart", applied, useCredit],
    queryFn: () => api<CartQuoteResponse>("/cart/quote", { method: "POST", body: { coupon: applied, use_credit: useCredit } }),
  });

  useEffect(() => {
    if (!addr && addresses.data?.length) setAddr(addresses.data.find((a) => a.is_default) ?? addresses.data[0]);
  }, [addresses.data, addr]);

  const setQty = async (product_id: string, qty: number) => {
    const item = q.data?.items.find((i) => i.product_id === product_id);
    let rollback: (() => void) | null = null;
    if (item) {
      rollback = applyOptimisticCartItem(
        {
          id: item.product_id,
          seller_id: item.seller_id || "",
          name: item.name,
          price: item.price,
          category: "food",
          veg: item.veg ?? true,
          available: true,
          stock: 99,
          image: item.image || "",
          description: "",
        },
        qty
      );
    }
    try {
      await api("/cart/items", { method: "POST", body: { product_id, qty } });
      qc.invalidateQueries({ queryKey: ["cart"] });
    } catch (e: any) {
      if (rollback) rollback();
      toast(e.message, "err");
    }
  };

  const removeStoreItems = (sellerId: string, storeName: string) => {
    Alert.alert(
      "Remove restaurant?",
      `Are you sure you want to remove all items from ${storeName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await api(`/cart/sellers/${sellerId}`, { method: "DELETE" });
              qc.invalidateQueries({ queryKey: ["cart"] });
              toast(`Removed items from ${storeName}`);
            } catch (e: any) {
              toast(e.message, "err");
            }
          },
        },
      ]
    );
  };

  const applyCouponCode = async (codeToApply: string) => {
    const code = codeToApply.trim().toUpperCase();
    if (!code) return;
    try {
      const r = await api<CartQuoteResponse>("/cart/quote", { method: "POST", body: { coupon: code, use_credit: useCredit } });
      if (r.bill?.error) throw new Error(r.bill.error);
      setApplied(code);
      setCoupon("");
      toast(`${code} coupon applied successfully! 🎉`);
    } catch (e: any) {
      toast(e.message, "err");
    }
  };

  const removeCoupon = () => {
    setApplied(null);
    setCoupon("");
    toast("Coupon removed");
  };

  const place = async () => {
    if (!addr) return setPicker(true);
    setPlacing(true);
    try {
      const order = await api<{ id: string }>("/orders/checkout", {
        method: "POST",
        body: { address_id: addr.id, coupon: applied, use_credit: useCredit, schedule },
      });
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      setApplied(null); setCoupon(""); setUseCredit(false);
      router.push(`/pay/${order.id}`);
      refresh();
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setPlacing(false);
    }
  };

  const data = q.data;
  const groups: CartStoreGroup[] = data?.groups?.length
    ? data.groups
    : data?.seller
    ? [
        {
          seller: data.seller,
          items: data.items,
          unavailable: data.unavailable,
          bill: data.bill,
          subtotal: data.items.reduce((s, i) => s + i.line_total, 0),
          rider_assigned_separately: false,
        },
      ]
    : [];

  const toggleStoreCollapse = (sellerId: string) => {
    setCollapsedStores((prev) => ({
      ...prev,
      [sellerId]: !prev[sellerId],
    }));
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  const openStore = (sellerId: string) => {
    router.push(`/seller/${sellerId}`);
  };

  const storeCount = groups.length;
  const isMulti = storeCount > 1;
  const totalItemCount = data?.total_items || data?.items?.reduce((s, i) => s + (i.qty || 0), 0) || 0;
  const bill = data?.bill;
  const totalSavings = bill?.total_savings || bill?.discount || 0;
  const availableCoupons = data?.available_coupons ?? [];

  return (
    <View style={s.root}>
      {/* Background Graphic matching Home/Groceries/Listing screens */}
      <Image
        source={require("@/assets/images/gathr_home_bg.jpg")}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        priority="high"
      />

      {/* Redesigned Header Matching User UI */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerRow}>
          <Pressable
            testID="cart-back-button"
            onPress={handleBack}
            hitSlop={12}
            style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="chevron-back" size={24} color="#1E293B" />
          </Pressable>

          <View style={{ flex: 1, justifyContent: "center" }}>
            <Text style={s.storeCountHeader}>
              {storeCount} {storeCount === 1 ? "restaurant" : "restaurants"}
            </Text>
            <Pressable
              testID="cart-header-address-picker"
              onPress={() => setPicker(true)}
              style={s.addressRowHeader}
            >
              <Text style={s.deliveryTitle}>
                Delivery at {addr?.label || "Home"}
              </Text>
              <View style={s.addressDivider} />
              <Text style={s.addressSub} numberOfLines={1}>
                {addr?.line ? `${addr.line}${addr.landmark ? `, ${addr.landmark}` : ""}` : "Select delivery location"}
              </Text>
              <Ionicons name="chevron-down" size={14} color="#475569" style={{ marginLeft: 2 }} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Pastel Soft Blue Savings Banner right below header */}
      {totalSavings > 0 ? (
        <View style={s.savingsBanner}>
          <Text style={s.savingsEmoji}>🥳</Text>
          <Text style={s.savingsText}>
            You saved <Text style={s.savingsBold}>{rupee(totalSavings)}</Text> on this order
          </Text>
        </View>
      ) : null}

      {q.isLoading ? (
        <CartSkeleton />
      ) : q.isError ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
      ) : !data?.items.length && !data?.unavailable.length ? (
        <EmptyState
          testID="cart-empty"
          icon="bag-handle-outline"
          title="Your cart is empty"
          body="Explore delicious food, fresh grocery items, and essentials from nearby shops."
          action="Start Shopping"
          onAction={() => router.push("/listing/food")}
        />
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Redesigned Store Cards */}
            {groups.map((group, gIdx) => {
              const sellerKey = group.seller.id || String(gIdx);
              const note = storeNotes[sellerKey];
              const cutleryPref = !!noCutlery[sellerKey];

              return (
                <View key={sellerKey} style={s.storeCard} testID={`cart-store-group-${sellerKey}`}>
                  {/* Store Header Row */}
                  <View style={s.storeHeader}>
                    <Pressable
                      style={s.storeHeaderClickable}
                      onPress={() => openStore(sellerKey)}
                    >
                      <Image
                        source={{ uri: group.seller.image }}
                        style={s.storeImg}
                        contentFit="cover"
                        transition={150}
                      />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={s.storeName} numberOfLines={1}>{group.seller.name}</Text>
                        <View style={s.storeMetaRow}>
                          <Ionicons name="time-outline" size={14} color="#64748B" />
                          <Text style={s.storeMeta}>
                            {group.seller.eta_min ? `${group.seller.eta_min}-${Number(group.seller.eta_min) + 5} mins` : "30-35 mins"}
                          </Text>
                        </View>
                      </View>
                    </Pressable>

                    <Pressable
                      testID={`cart-store-remove-${sellerKey}`}
                      onPress={() => removeStoreItems(sellerKey, group.seller.name)}
                      hitSlop={8}
                      style={s.storeRemoveBtn}
                    >
                      <Text style={s.storeRemoveBtnText}>Remove</Text>
                    </Pressable>
                  </View>

                  <View style={s.storeDivider} />

                  {/* Items in this store */}
                  <View style={s.storeItemsList}>
                    {group.items.map((l, lIdx) => (
                      <View
                        key={l.product_id}
                        style={s.lineItemRow}
                        testID={`cart-line-${l.product_id}`}
                      >
                        <View style={s.vegWrapper}>
                          <VegMark veg={l.veg} />
                        </View>

                        <View style={s.itemInfoCol}>
                          <Text style={s.lineName} numberOfLines={2}>{l.name}</Text>
                          {l.price > 400 ? (
                            <Text style={s.notEligibleText}>NOT ELIGIBLE FOR COUPONS</Text>
                          ) : null}
                        </View>

                        {/* Stepper + Price stacked on right exactly as in the UI image */}
                        <View style={s.stepperPriceCol}>
                          <View style={s.imageStepperBox}>
                            <Pressable
                              testID={`cart-stepper-${l.product_id}-dec`}
                              onPress={() => setQty(l.product_id, l.qty - 1)}
                              hitSlop={6}
                              style={s.stepperBtn}
                            >
                              <Ionicons name="remove" size={14} color="#EF4444" />
                            </Pressable>
                            <Text testID={`cart-stepper-${l.product_id}-qty`} style={s.stepperQtyText}>
                              {l.qty}
                            </Text>
                            <Pressable
                              testID={`cart-stepper-${l.product_id}-inc`}
                              onPress={() => setQty(l.product_id, l.qty + 1)}
                              hitSlop={6}
                              style={s.stepperBtn}
                            >
                              <Ionicons name="add" size={14} color="#EF4444" />
                            </Pressable>
                          </View>
                          <Text style={s.linePriceText}>{rupee(l.line_total)}</Text>
                        </View>
                      </View>
                    ))}

                    {group.unavailable.map((l) => (
                      <View key={l.product_id} style={[s.lineItemRow, s.lineUnavailable]}>
                        <Ionicons name="alert-circle-outline" size={18} color="#EF4444" />
                        <View style={{ flex: 1 }}>
                          <Text style={[s.lineName, { color: "#94A3B8" }]} numberOfLines={1}>
                            {l.name}
                          </Text>
                          <Text style={{ fontSize: 11, color: "#EF4444" }}>
                            {(l as any).reason || "Out of stock"}
                          </Text>
                        </View>
                        <Pressable
                          testID={`cart-remove-unavailable-${l.product_id}`}
                          onPress={() => setQty(l.product_id, 0)}
                          style={s.storeRemoveBtn}
                        >
                          <Text style={s.storeRemoveBtnText}>Remove</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>

                  {/* Note entered indicator if present */}
                  {note ? (
                    <View style={s.activeNoteBanner}>
                      <Ionicons name="document-text-outline" size={14} color="#475569" />
                      <Text style={s.activeNoteText} numberOfLines={1}>
                        Note: "{note}"
                      </Text>
                      <Pressable onPress={() => setStoreNotes((prev) => ({ ...prev, [sellerKey]: "" }))}>
                        <Ionicons name="close-circle" size={16} color="#94A3B8" />
                      </Pressable>
                    </View>
                  ) : null}

                  {/* Inline Note Input if active for this seller */}
                  {editingNoteSeller === sellerKey ? (
                    <View style={s.inlineNoteInputRow}>
                      <TextInput
                        value={tempNoteText}
                        onChangeText={setTempNoteText}
                        placeholder="e.g. Extra spicy, less oil, ring bell"
                        placeholderTextColor="#94A3B8"
                        style={s.inlineNoteInput}
                        autoFocus
                      />
                      <Pressable
                        onPress={() => {
                          if (tempNoteText.trim()) {
                            setStoreNotes((prev) => ({ ...prev, [sellerKey]: tempNoteText.trim() }));
                            toast("Instruction added for restaurant");
                          }
                          setEditingNoteSeller(null);
                          setTempNoteText("");
                        }}
                        style={s.saveNoteBtn}
                      >
                        <Text style={s.saveNoteBtnText}>Save</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setEditingNoteSeller(null);
                          setTempNoteText("");
                        }}
                        style={s.cancelNoteBtn}
                      >
                        <Text style={s.cancelNoteBtnText}>Cancel</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {/* Store Action Pills: + Add more items, Add note, Don't send cutlery */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.storeActionPillsRow}
                  >
                    <Pressable
                      style={s.actionPillRed}
                      onPress={() => openStore(sellerKey)}
                    >
                      <Ionicons name="add" size={15} color="#EF4444" />
                      <Text style={s.actionPillRedText}>Add more items</Text>
                    </Pressable>

                    <Pressable
                      style={[s.actionPillGray, !!note && s.actionPillActive]}
                      onPress={() => {
                        setEditingNoteSeller(sellerKey);
                        setTempNoteText(storeNotes[sellerKey] || "");
                      }}
                    >
                      <Ionicons name="document-text-outline" size={15} color="#475569" />
                      <Text style={s.actionPillGrayText}>
                        {note ? "Edit note" : "Add a note for the restaurant"}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[s.actionPillGray, cutleryPref && s.actionPillActive]}
                      onPress={() => {
                        setNoCutlery((prev) => {
                          const updated = !prev[sellerKey];
                          toast(updated ? "Opted out of cutlery 🌱" : "Cutlery requested");
                          return { ...prev, [sellerKey]: updated };
                        });
                      }}
                    >
                      <Ionicons
                        name={cutleryPref ? "checkmark-circle" : "restaurant-outline"}
                        size={15}
                        color={cutleryPref ? "#16A34A" : "#475569"}
                      />
                      <Text style={[s.actionPillGrayText, cutleryPref && { color: "#16A34A", fontWeight: "700" }]}>
                        {cutleryPref ? "No cutlery opted" : "Don't send cutlery"}
                      </Text>
                    </Pressable>
                  </ScrollView>
                </View>
              );
            })}

            {/* Delivery Schedule Options */}
            <View style={s.card}>
              <View style={s.sectionHeaderRow}>
                <View style={[s.sectionIconCircle, { backgroundColor: colors.pastelSky }]}>
                  <Ionicons name="time" size={16} color={colors.onPastelSky} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>Delivery Schedule</Text>
                  <Text style={s.cardSubtitle}>Choose when you'd like your order delivered</Text>
                </View>
              </View>

              <View style={{ marginHorizontal: -spacing.md, marginTop: spacing.sm }}>
                <ChipRow>
                  {SCHEDULES.map((x) => (
                    <Chip
                      key={x.key}
                      testID={`cart-schedule-${x.key}`}
                      label={x.label}
                      icon={x.icon}
                      selected={schedule === x.key}
                      onPress={() => setSchedule(x.key)}
                    />
                  ))}
                </ChipRow>
              </View>
            </View>

            {/* Coupons & Offers Section */}
            <View style={s.card}>
              <View style={s.sectionHeaderRow}>
                <View style={[s.sectionIconCircle, { backgroundColor: colors.pastelLemon }]}>
                  <Ionicons name="pricetag" size={16} color={colors.onPastelLemon} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>Coupons & Offers</Text>
                  <Text style={s.cardSubtitle}>Apply promo codes for extra discounts</Text>
                </View>
              </View>

              {applied ? (
                <View style={s.appliedCouponBox} testID="cart-coupon-applied">
                  <View style={s.appliedCouponLeft}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.onPastelMint} />
                    <View>
                      <Text style={s.appliedCouponCode}>{applied}</Text>
                      <Text style={s.appliedCouponSaved}>
                        {bill?.discount ? `Saved ${rupee(bill.discount)} with this code!` : "Offer applied"}
                      </Text>
                    </View>
                  </View>
                  <Pressable testID="cart-coupon-remove" onPress={removeCoupon} style={s.removeCouponBtn}>
                    <Text style={s.removeCouponText}>Remove</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <View style={s.couponInputRow}>
                    <TextInput
                      testID="cart-coupon-input"
                      value={coupon}
                      onChangeText={setCoupon}
                      placeholder="Enter coupon code (e.g. GATHR50)"
                      autoCapitalize="characters"
                      placeholderTextColor={colors.muted}
                      style={s.couponInput}
                    />
                    <Pressable
                      testID="cart-coupon-apply"
                      onPress={() => applyCouponCode(coupon)}
                      style={({ pressed }) => [s.applyBtn, (!coupon.trim() || pressed) && { opacity: 0.6 }]}
                      disabled={!coupon.trim()}
                    >
                      <Text style={s.applyBtnText}>APPLY</Text>
                    </Pressable>
                  </View>

                  {/* Available Quick-Apply Coupons */}
                  {availableCoupons.length > 0 ? (
                    <View style={s.availableCouponsWrap}>
                      <Pressable
                        style={s.viewCouponsToggle}
                        onPress={() => setCouponExpanded(!couponExpanded)}
                      >
                        <Text style={s.viewCouponsText}>
                          {couponExpanded ? "Hide available offers" : `View ${availableCoupons.length} available offers`}
                        </Text>
                        <Ionicons name={couponExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.brandPrimary} />
                      </Pressable>

                      {couponExpanded && (
                        <View style={s.couponsList}>
                          {availableCoupons.map((c) => (
                            <View key={c.code} style={s.couponItemCard}>
                              <View style={{ flex: 1, gap: 2 }}>
                                <View style={s.couponBadge}>
                                  <Text style={s.couponBadgeText}>{c.code}</Text>
                                </View>
                                <Text style={s.couponItemDesc}>{c.description}</Text>
                                {c.min_order > 0 ? (
                                  <Text style={s.couponItemMin}>On orders above {rupee(c.min_order)}</Text>
                                ) : null}
                              </View>
                              <Pressable
                                onPress={() => applyCouponCode(c.code)}
                                style={s.quickApplyBtn}
                              >
                                <Text style={s.quickApplyBtnText}>Apply</Text>
                              </Pressable>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ) : null}
                </>
              )}

              {/* Free delivery credit toggle */}
              {(user?.delivery_credits ?? 0) > 0 ? (
                <View style={s.creditRow}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.creditTitle}>
                      Use free delivery credit ({user?.delivery_credits} available)
                    </Text>
                    <Text style={s.creditSub}>Waives standard delivery charges for this order</Text>
                  </View>
                  <Switch
                    testID="cart-use-credit-switch"
                    value={useCredit}
                    onValueChange={setUseCredit}
                    trackColor={{ true: colors.brandSecondary, false: colors.borderStrong }}
                    thumbColor={colors.surface}
                  />
                </View>
              ) : null}
            </View>

            {/* Premium Bill Details Breakdown */}
            {bill ? (
              <View style={s.card} testID="cart-bill">
                <View style={s.sectionHeaderRow}>
                  <View style={[s.sectionIconCircle, { backgroundColor: colors.pastelMint }]}>
                    <Ionicons name="receipt" size={16} color={colors.onPastelMint} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>Bill Details</Text>
                    <Text style={s.cardSubtitle}>Transparent pricing with all discounts & taxes</Text>
                  </View>
                </View>

                {bill.error ? (
                  <View style={s.billErrorBox}>
                    <Ionicons name="alert-circle" size={18} color={colors.error} />
                    <Text testID="cart-bill-error" style={s.billErrorText}>
                      {bill.error}
                    </Text>
                  </View>
                ) : (
                  <View style={s.billRowsList}>
                    {/* Items Subtotal */}
                    <BillRow
                      label={`Item Subtotal (${groups.length} ${groups.length > 1 ? "shops" : "shop"})`}
                      value={rupee(bill.subtotal)}
                    />

                    {/* Instant Item-level Store Discount if applicable */}
                    {bill.item_discount && bill.item_discount > 0 ? (
                      <BillRow
                        label="Item Instant Discount"
                        value={`-${rupee(bill.item_discount)}`}
                        accent
                      />
                    ) : null}

                    {/* Promo Coupon Discount */}
                    {(bill.discount && bill.discount > 0) || (applied && bill.discount !== undefined) ? (
                      <BillRow
                        label={`Coupon Discount (${bill.coupon || applied || "Applied"})`}
                        value={`-${rupee(bill.discount || 0)}`}
                        accent
                      />
                    ) : null}

                    {/* Delivery Partner Fee */}
                    <BillRow
                      label={isMulti ? `Delivery Partner Fees (${storeCount} riders)` : "Delivery Partner Fee"}
                      value={
                        bill.delivery_fee === 0
                          ? `FREE`
                          : rupee(bill.delivery_fee)
                      }
                      accent={bill.delivery_fee === 0}
                    />

                    {/* Delivery Funding Subtext note */}
                    {bill.delivery_fee === 0 && (
                      <View style={s.freeDeliveryBadge}>
                        <Ionicons name="shield-checkmark" size={13} color={colors.onPastelMint} />
                        <Text style={s.freeDeliveryBadgeText}>
                          {bill.delivery_funding === "delivery_credit"
                            ? "Covered via your delivery credit"
                            : "Free delivery unlocked on this order"}
                        </Text>
                      </View>
                    )}

                    {/* Platform & Handling Fee */}
                    <BillRow label="Platform & Handling Fee" value={rupee(bill.convenience_fee)} />

                    <View style={s.billDottedDivider} />

                    {/* Grand Total */}
                    <View style={s.grandTotalRow}>
                      <View>
                        <Text style={s.grandTotalLabel}>To Pay</Text>
                        <Text style={s.grandTotalSub}>Inclusive of all taxes</Text>
                      </View>
                      <Text style={s.grandTotalValue} testID="cart-bill-total">
                        {rupee(bill.total)}
                      </Text>
                    </View>

                    {/* Total Saved pill */}
                    {totalSavings > 0 ? (
                      <View style={s.savedPill}>
                        <Ionicons name="checkmark-done-circle" size={16} color={colors.onPastelMint} />
                        <Text style={s.savedPillText}>Total Savings: {rupee(totalSavings)}</Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
            ) : null}

            {/* Cancellation Policy Note */}
            <View style={s.policyBox}>
              <Ionicons name="information-circle-outline" size={18} color={colors.muted} />
              <Text style={s.policyText}>
                Orders cannot be cancelled once preparation starts at the merchant. Live order tracking will be active upon checkout.
              </Text>
            </View>
          </ScrollView>

          {/* Sticky Checkout Button Matching Image */}
          <View style={[s.footer, { paddingBottom: bottomChrome + spacing.sm }]}>
            <Pressable
              testID="cart-place-order-button"
              disabled={placing || !bill || !!bill.error || !data.items.length}
              onPress={place}
              style={({ pressed }) => [
                s.payButton,
                pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
                (placing || !bill || !!bill.error || !data.items.length) && { opacity: 0.5 },
              ]}
            >
              <Text style={s.payButtonText}>
                {placing ? "Processing..." : bill?.total ? `Proceed to Pay · ${rupee(bill.total)}` : "Add Payment Method"}
              </Text>
            </Pressable>
          </View>
        </>
      )}
      <AddressPicker visible={picker} onClose={() => setPicker(false)} selected={addr?.id} onSelect={setAddr} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: "#FFFFFF" },

  // Redesigned Header
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: 10,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(226, 232, 240, 0.6)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    padding: 4,
    marginLeft: -4,
  },
  storeCountHeader: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 1,
  },
  addressRowHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  deliveryTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  addressDivider: {
    width: 1,
    height: 12,
    backgroundColor: "#CBD5E1",
    marginHorizontal: 8,
  },
  addressSub: {
    flex: 1,
    fontSize: 12,
    color: "#475569",
    fontWeight: "500",
  },

  // Soft Blue / Pastel Savings Banner
  savingsBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 241, 242, 0.88)",
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(254, 205, 211, 0.6)",
  },
  savingsEmoji: {
    fontSize: 15,
  },
  savingsText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#E11D48",
  },
  savingsBold: {
    fontWeight: "900",
  },

  // Redesigned Store Card
  storeCard: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 228, 230, 0.7)",
    shadowColor: "#000",
    shadowOpacity: 0.015,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 0.5,
  },
  storeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  storeHeaderClickable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  storeImg: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
  },
  storeName: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  storeMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  storeMeta: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  storeRemoveBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  storeRemoveBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  storeDivider: {
    height: 1,
    borderWidth: 1,
    borderColor: "rgba(254, 205, 211, 0.5)",
    borderStyle: "dotted",
    marginHorizontal: 14,
    marginBottom: 4,
  },

  // Store Items List
  storeItemsList: {
    paddingHorizontal: 14,
  },
  lineItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    gap: 10,
  },
  vegWrapper: {
    marginTop: 3,
  },
  itemInfoCol: {
    flex: 1,
    gap: 4,
    paddingRight: 8,
  },
  lineName: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#1E293B",
    lineHeight: 18,
  },
  notEligibleText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.4,
  },
  stepperPriceCol: {
    alignItems: "flex-end",
    gap: 6,
  },
  imageStepperBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: 84,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FECDD3",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 4,
  },
  stepperBtn: {
    width: 24,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperQtyText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#F43F5E",
  },
  linePriceText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0F172A",
  },
  lineUnavailable: {
    opacity: 0.6,
    backgroundColor: "rgba(220, 53, 69, 0.04)",
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    marginVertical: 4,
  },

  // Active Note / Input
  activeNoteBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 14,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#FFF1F2",
  },
  activeNoteText: {
    flex: 1,
    fontSize: 11.5,
    color: "#475569",
    fontWeight: "500",
  },
  inlineNoteInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 14,
    marginTop: 8,
  },
  inlineNoteInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 12,
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
  },
  saveNoteBtn: {
    backgroundColor: "#F43F5E",
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  saveNoteBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  cancelNoteBtn: {
    paddingHorizontal: 8,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelNoteBtnText: {
    color: "#64748B",
    fontSize: 12,
  },

  // Action Pills Row
  storeActionPillsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  actionPillRed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FECDD3",
    backgroundColor: "#FFF1F2",
  },
  actionPillRedText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#F43F5E",
  },
  actionPillGray: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.9)",
    backgroundColor: "#FFFFFF",
  },
  actionPillActive: {
    borderColor: "#86EFAC",
    backgroundColor: "#F0FDF4",
  },
  actionPillGrayText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },

  // Base Card (Schedules, Offers, Bill Details)
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255, 228, 230, 0.7)",
    shadowColor: "#000",
    shadowOpacity: 0.015,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 0.5,
    gap: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 4,
  },
  sectionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: font.base,
    fontWeight: "800",
    color: "#0F172A",
  },
  cardSubtitle: {
    fontSize: 11,
    color: "#64748B",
  },

  // Coupons Box
  couponInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FECDD3",
    borderRadius: radius.md,
    backgroundColor: "#FFF8F9",
    overflow: "hidden",
    paddingLeft: spacing.md,
    marginTop: spacing.xs,
  },
  couponInput: {
    flex: 1,
    height: 44,
    color: c.onSurface,
    fontSize: font.sm + 1,
    fontWeight: "600",
  },
  applyBtn: {
    height: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    backgroundColor: "#F43F5E",
  },
  applyBtnText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: font.sm,
    letterSpacing: 0.5,
  },
  appliedCouponBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: c.pastelMint,
    borderWidth: 1,
    borderColor: "rgba(30, 122, 76, 0.25)",
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  appliedCouponLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  appliedCouponCode: {
    fontWeight: "900",
    color: c.onPastelMint,
    fontSize: font.base,
    letterSpacing: 0.5,
  },
  appliedCouponSaved: {
    fontSize: 11,
    color: c.onPastelMint,
    fontWeight: "600",
  },
  removeCouponBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  removeCouponText: {
    color: c.error,
    fontWeight: "800",
    fontSize: font.sm,
  },
  availableCouponsWrap: {
    marginTop: 4,
  },
  viewCouponsToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  viewCouponsText: {
    color: "#F43F5E",
    fontWeight: "700",
    fontSize: font.sm,
  },
  couponsList: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  couponItemCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
  },
  couponBadge: {
    alignSelf: "flex-start",
    backgroundColor: c.pastelLemon,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(138, 106, 0, 0.2)",
  },
  couponBadgeText: {
    fontWeight: "900",
    fontSize: 11,
    color: c.onPastelLemon,
    letterSpacing: 0.5,
  },
  couponItemDesc: {
    fontSize: font.sm,
    fontWeight: "600",
    color: c.onSurface,
    marginTop: 2,
  },
  couponItemMin: {
    fontSize: 11,
    color: c.muted,
  },
  quickApplyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: "#FFE4E6",
    borderWidth: 1,
    borderColor: "#FECDD3",
  },
  quickApplyBtnText: {
    color: "#F43F5E",
    fontWeight: "800",
    fontSize: font.sm,
  },
  creditRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: c.divider,
  },
  creditTitle: {
    fontSize: font.sm + 1,
    fontWeight: "700",
    color: c.onSurface,
  },
  creditSub: {
    fontSize: 11,
    color: c.muted,
  },

  // Bill Details
  billErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: spacing.md,
    backgroundColor: "rgba(220, 53, 69, 0.08)",
    borderRadius: radius.md,
  },
  billErrorText: {
    color: c.error,
    fontWeight: "700",
    fontSize: font.sm,
    flex: 1,
  },
  billRowsList: {
    gap: 4,
  },
  freeDeliveryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 4,
    marginTop: -2,
    marginBottom: 4,
  },
  freeDeliveryBadgeText: {
    fontSize: 11,
    color: c.onPastelMint,
    fontWeight: "600",
  },
  billDottedDivider: {
    height: 1,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
    marginVertical: spacing.md,
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  grandTotalLabel: {
    fontSize: font.lg,
    fontWeight: "900",
    color: c.onSurface,
  },
  grandTotalSub: {
    fontSize: 11,
    color: c.muted,
  },
  grandTotalValue: {
    fontSize: font.xl + 2,
    fontWeight: "900",
    color: c.onSurface,
  },
  savedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: c.pastelMint,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(30, 122, 76, 0.2)",
  },
  savedPillText: {
    fontSize: 12,
    fontWeight: "800",
    color: c.onPastelMint,
  },

  // Policy Note
  policyBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.6)",
  },
  policyText: {
    flex: 1,
    color: c.muted,
    fontSize: 11,
    lineHeight: 16,
  },

  // Checkout Footer
  footer: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(226, 232, 240, 0.8)",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: -2 },
    elevation: 3,
  },
  payButton: {
    backgroundColor: "#F43F5E", // Vibrant rose-red matching app primary
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F43F5E",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1.5,
  },
  payButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
}));
