import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  Dimensions,
  Animated as RNAnimated,
  Easing,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Product, Seller } from "@/src/types";
import { mediaUri, rupee } from "@/src/format";
import { Ionicons, VegMark } from "@/src/ui";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ProductDetailModalProps {
  visible: boolean;
  product: Product | null;
  seller?: Seller | null;
  currentQty?: number;
  onClose: () => void;
  onAddToCart: (product: Product, qty: number, cookingRequest?: string) => void;
}

const PRESET_REQUESTS = [
  "Less Spicy",
  "Non spicy",
  "Mild spicy",
  "Extra Masala",
  "Without Onion",
  "Extra Gravy",
];

const GROCERY_DELIVERY_NOTES = [
  "Freshly handpicked & sorted by store staff",
  "Cleaned and hygienically packed",
  "Best before expiry guaranteed",
  "Delivered safely to your doorstep",
];

export default function ProductDetailModal({
  visible,
  product,
  seller,
  currentQty = 0,
  onClose,
  onAddToCart,
}: ProductDetailModalProps) {
  const insets = useSafeAreaInsets();
  const [qty, setQty] = useState(1);
  const [cookingRequest, setCookingRequest] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Determine whether item is prepared food or grocery/kirana/vegetables
  const isPreparedFood = useMemo(() => {
    if (!product) return true;
    const cat = (product.category || "").toLowerCase();
    const sellerCat = (seller?.category || "").toLowerCase();

    // Grocery keywords
    const groceryKeywords = [
      "vegetable",
      "fruit",
      "kirana",
      "grocery",
      "staple",
      "dairy",
      "milk",
      "egg",
      "spice",
      "masala",
      "powder",
      "atta",
      "rice",
      "oil",
      "dal",
      "pulse",
      "snack",
      "beverage",
      "dry fruit",
      "cleaning",
      "personal care",
      "organics",
    ];

    if (sellerCat === "grocery") return false;
    if (groceryKeywords.some((kw) => cat.includes(kw))) return false;

    return true;
  }, [product, seller]);

  // Separate animation drivers
  const backdropAnim = useRef(new RNAnimated.Value(0)).current;
  const slideAnim = useRef(new RNAnimated.Value(SCREEN_HEIGHT)).current;
  const [showModal, setShowModal] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      setQty(currentQty > 0 ? currentQty : 1);
      setCookingRequest("");
      setDeliveryNote("");

      backdropAnim.setValue(0);
      slideAnim.setValue(SCREEN_HEIGHT * 0.85);

      RNAnimated.parallel([
        RNAnimated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        RNAnimated.spring(slideAnim, {
          toValue: 0,
          damping: 28,
          stiffness: 280,
          mass: 0.9,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      RNAnimated.parallel([
        RNAnimated.timing(backdropAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        RNAnimated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT * 0.85,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowModal(false);
      });
    }
  }, [visible, currentQty, backdropAnim, slideAnim]);

  if (!showModal || !product) return null;

  const handleClose = () => {
    RNAnimated.parallel([
      RNAnimated.timing(backdropAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      RNAnimated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT * 0.85,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const handleChipPress = (chipText: string) => {
    if (cookingRequest.includes(chipText)) {
      const updated = cookingRequest
        .replace(chipText, "")
        .replace(/,\s*,/g, ",")
        .trim();
      setCookingRequest(updated.replace(/^,\s*|,\s*$/g, ""));
    } else {
      const separator = cookingRequest.trim().length > 0 ? ", " : "";
      if ((cookingRequest + separator + chipText).length <= 100) {
        setCookingRequest(cookingRequest + separator + chipText);
      }
    }
  };

  const handleIncrement = () => setQty((prev) => Math.min(prev + 1, 99));
  const handleDecrement = () => setQty((prev) => Math.max(prev - 1, 1));

  const totalAmount = (product.price || 0) * qty;

  return (
    <Modal
      visible={showModal}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Semi-transparent backdrop fades in/out in-place without sliding */}
        <RNAnimated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropAnim,
            },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </RNAnimated.View>

        {/* Bottom Sheet Card sliding up */}
        <RNAnimated.View
          style={[
            styles.sheetContainer,
            {
              transform: [{ translateY: slideAnim }],
              paddingBottom: Math.max(insets.bottom, 14),
            },
          ]}
        >
          {/* Floating Circular Close Button positioned right above the card's top edge */}
          <Pressable
            testID="product-detail-close-btn"
            onPress={handleClose}
            style={styles.floatingCloseBtn}
            hitSlop={12}
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </Pressable>

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* 1. Large Hero Dish Image */}
            <View style={styles.imageContainer}>
              <Image
                source={{
                  uri: mediaUri(
                    product.image ||
                      seller?.image ||
                      "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800&q=80"
                  ),
                }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
              />
            </View>

            {/* 2. Header Row: Veg Icon, Title, Bookmark & Share Buttons */}
            <View style={styles.dishHeaderSection}>
              <View style={styles.vegMarkWrapper}>
                <VegMark veg={product.veg} />
              </View>

              <View style={styles.titleActionRow}>
                <Text style={styles.dishTitle} numberOfLines={2}>
                  {product.name}
                </Text>

                <View style={styles.iconActionsRow}>
                  {/* Bookmark Button */}
                  <Pressable
                    onPress={() => setIsBookmarked(!isBookmarked)}
                    hitSlop={8}
                    style={styles.iconActionButton}
                  >
                    <Ionicons
                      name={isBookmarked ? "bookmark" : "bookmark-outline"}
                      size={20}
                      color={isBookmarked ? "#F43F5E" : "#4B5563"}
                    />
                  </Pressable>

                  {/* Share Button */}
                  <Pressable
                    onPress={() => {}}
                    hitSlop={8}
                    style={styles.iconActionButton}
                  >
                    <Ionicons name="share-social-outline" size={20} color="#4B5563" />
                  </Pressable>
                </View>
              </View>

              {/* 3. "Highly reordered" green pill tag */}
              <View style={styles.reorderedPill}>
                <View style={styles.reorderedIndicator} />
                <Text style={styles.reorderedText}>Highly reordered</Text>
              </View>

              {/* 4. Description */}
              <Text style={styles.dishDescription}>
                {product.description ||
                  (isPreparedFood
                    ? "Fragrant authentic preparation with selected fresh ingredients and traditional seasonings."
                    : "Freshly sourced high quality produce, inspected and packed with utmost hygiene and care.")}
              </Text>
            </View>

            {/* Subtle Divider */}
            <View style={styles.divider} />

            {/* 5. Conditional Section: Cooking Request OR Product & Quality Guarantee Details */}
            {isPreparedFood ? (
              <View style={styles.requestSection}>
                <Text style={styles.requestSectionTitle}>
                  Add a cooking request (optional)
                </Text>
                <Text style={styles.requestSectionSubtitle}>
                  The restaurant will try its best to fulfil your requests. However, refunds or cancellations related to such requests won't be possible.
                </Text>

                {/* Text Input Container with character limit counter */}
                <View style={styles.requestInputContainer}>
                  <TextInput
                    value={cookingRequest}
                    onChangeText={(text) => {
                      if (text.length <= 100) setCookingRequest(text);
                    }}
                    placeholder="e.g. Don't make it too spicy"
                    placeholderTextColor="#9CA3AF"
                    style={styles.requestTextInput}
                    multiline
                    maxLength={100}
                  />
                  <Text style={styles.requestCharCount}>
                    {100 - cookingRequest.length}
                  </Text>
                </View>

                {/* Preset Quick Chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsScrollContent}
                  style={styles.chipsScroll}
                >
                  {PRESET_REQUESTS.map((chip) => {
                    const isSelected = cookingRequest.includes(chip);
                    return (
                      <Pressable
                        key={chip}
                        onPress={() => handleChipPress(chip)}
                        style={[
                          styles.chipPill,
                          isSelected && styles.chipPillSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipPillText,
                            isSelected && styles.chipPillTextSelected,
                          ]}
                        >
                          {chip}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : (
              <View style={styles.grocerySection}>
                <Text style={styles.requestSectionTitle}>
                  Product Details & Quality Assurance
                </Text>
                <Text style={styles.requestSectionSubtitle}>
                  Sourced straight from trusted local markets & certified vendors.
                </Text>

                {/* Highlight Info Grid */}
                <View style={styles.groceryHighlightsBox}>
                  {GROCERY_DELIVERY_NOTES.map((note, idx) => (
                    <View key={`note-${idx}`} style={styles.groceryNoteRow}>
                      <View style={styles.groceryCheckCircle}>
                        <Ionicons name="checkmark" size={13} color="#16A34A" />
                      </View>
                      <Text style={styles.groceryNoteText}>{note}</Text>
                    </View>
                  ))}
                </View>

                {/* Key Product Attributes Card */}
                <View style={styles.groceryAttributesCard}>
                  <View style={styles.attrItem}>
                    <Text style={styles.attrLabel}>Category</Text>
                    <Text style={styles.attrValue} numberOfLines={1}>
                      {product.category || "Produce"}
                    </Text>
                  </View>
                  <View style={styles.attrDivider} />
                  <View style={styles.attrItem}>
                    <Text style={styles.attrLabel}>Shelf Life</Text>
                    <Text style={styles.attrValue}>2-4 Days</Text>
                  </View>
                  <View style={styles.attrDivider} />
                  <View style={styles.attrItem}>
                    <Text style={styles.attrLabel}>Storage</Text>
                    <Text style={styles.attrValue}>Cool & Dry</Text>
                  </View>
                </View>

                {/* Optional Instructions to Picker / Delivery Partner */}
                <View style={{ marginTop: 14 }}>
                  <Text style={styles.pickerNoteTitle}>
                    Delivery note for store / packer (optional)
                  </Text>
                  <View style={styles.requestInputContainer}>
                    <TextInput
                      value={deliveryNote}
                      onChangeText={(text) => {
                        if (text.length <= 100) setDeliveryNote(text);
                      }}
                      placeholder="e.g. Please pick fresh green leaves, avoid bruised pieces"
                      placeholderTextColor="#9CA3AF"
                      style={styles.requestTextInput}
                      multiline
                      maxLength={100}
                    />
                    <Text style={styles.requestCharCount}>
                      {100 - deliveryNote.length}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          {/* 6. Sticky Bottom Action Bar with Stepper and Add Item Button */}
          <View style={styles.bottomBar}>
            {/* Stepper [- 1 +] */}
            <View style={styles.stepperContainer}>
              <Pressable
                onPress={handleDecrement}
                style={styles.stepperBtn}
                hitSlop={6}
              >
                <Ionicons name="remove" size={18} color="#F43F5E" />
              </Pressable>
              <Text style={styles.stepperQtyText}>{qty}</Text>
              <Pressable
                onPress={handleIncrement}
                style={styles.stepperBtn}
                hitSlop={6}
              >
                <Ionicons name="add" size={18} color="#F43F5E" />
              </Pressable>
            </View>

            {/* Prominent Red/Rose Add Item Button */}
            <Pressable
              testID="modal-add-item-submit-btn"
              onPress={() => {
                const instructions = isPreparedFood ? cookingRequest.trim() : deliveryNote.trim();
                onAddToCart(product, qty, instructions);
                handleClose();
              }}
              style={({ pressed }) => [
                styles.addItemBtn,
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Text style={styles.addItemBtnText}>Add item {rupee(totalAmount)}</Text>
            </Pressable>
          </View>
        </RNAnimated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.58)",
  },
  floatingCloseBtn: {
    position: "absolute",
    top: -24,
    alignSelf: "center",
    zIndex: 100,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  sheetContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.86,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 20,
    position: "relative",
  },
  scrollContent: {
    paddingBottom: 24,
  },
  imageContainer: {
    width: "100%",
    height: 220,
    backgroundColor: "#F3F4F6",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  dishHeaderSection: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  vegMarkWrapper: {
    marginBottom: 6,
  },
  titleActionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  dishTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    flex: 1,
    lineHeight: 24,
    marginRight: 12,
  },
  iconActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  reorderedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    marginBottom: 8,
  },
  reorderedIndicator: {
    width: 20,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#15803D",
  },
  reorderedText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  dishDescription: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
    marginTop: 2,
  },
  divider: {
    height: 6,
    backgroundColor: "#F9FAFB",
    marginVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#F3F4F6",
  },
  requestSection: {
    paddingHorizontal: 16,
  },
  requestSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 4,
  },
  requestSectionSubtitle: {
    fontSize: 12,
    color: "#9CA3AF",
    lineHeight: 16,
    marginBottom: 12,
  },
  requestInputContainer: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    minHeight: 76,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    justifyContent: "space-between",
  },
  requestTextInput: {
    fontSize: 13,
    color: "#1F2937",
    textAlignVertical: "top",
    minHeight: 40,
  },
  requestCharCount: {
    fontSize: 11,
    color: "#9CA3AF",
    alignSelf: "flex-end",
    marginTop: 4,
  },
  chipsScroll: {
    marginTop: 12,
  },
  chipsScrollContent: {
    gap: 8,
    paddingRight: 16,
  },
  chipPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  chipPillSelected: {
    borderColor: "#F43F5E",
    backgroundColor: "#FFF1F2",
  },
  chipPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4B5563",
  },
  chipPillTextSelected: {
    color: "#F43F5E",
  },
  /* Grocery / Kirana Specific Styles */
  grocerySection: {
    paddingHorizontal: 16,
  },
  groceryHighlightsBox: {
    backgroundColor: "#F0FDF4",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#DCFCE7",
    gap: 8,
  },
  groceryNoteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  groceryCheckCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  groceryNoteText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#166534",
    flex: 1,
  },
  groceryAttributesCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  attrItem: {
    flex: 1,
    alignItems: "center",
  },
  attrLabel: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "500",
    marginBottom: 2,
  },
  attrValue: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#1E293B",
  },
  attrDivider: {
    width: 1,
    height: 22,
    backgroundColor: "#E2E8F0",
  },
  pickerNoteTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    backgroundColor: "#FFFFFF",
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.2,
    borderColor: "#FECDD3",
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 44,
    width: 96,
    backgroundColor: "#FFF5F6",
  },
  stepperBtn: {
    width: 24,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperQtyText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1F2937",
  },
  addItemBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#F43F5E",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F43F5E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  addItemBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
});
