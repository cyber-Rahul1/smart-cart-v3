import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { mediaUri, rupee } from "@/src/format";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Product } from "@/src/types";
import { Ionicons } from "@/src/ui";

/** Redesigned grocery product card matching UI reference */
export const GroceryCard = React.memo(function GroceryCard({ p, qty, busy, onChange, onOpen, width }: {
    p: Product; qty: number; busy: boolean; onChange: (n: number) => void; onOpen: () => void; width: number;
}) {
    const s = useStyles();
    const { colors } = useTheme();
    const low = p.available && p.stock < 10;

    return (
        <Pressable
            testID={`grocery-product-${p.id}`}
            onPress={onOpen}
            style={({ pressed }) => [s.card, { width }, pressed && { opacity: 0.95 }]}
        >
            <View style={s.imgWrap}>
                <Image
                    source={{ uri: mediaUri(p.image) }}
                    style={s.img}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    priority="normal"
                    transition={150}
                />
                {!p.available ? (
                    <View style={s.badge}><Text style={s.badgeText}>Out of stock</Text></View>
                ) : low ? (
                    <View style={s.badge}><Text style={s.badgeText}>Only {p.stock} left</Text></View>
                ) : null}
            </View>

            <View style={s.contentWrap}>
                <Text style={s.name} numberOfLines={1}>{p.name}</Text>
                
                <View style={s.storeRow}>
                    <Ionicons name="storefront-outline" size={13} color="#94A3B8" />
                    <Text style={s.store} numberOfLines={1}>{p.seller_name || "Nandi Dairy & Bakery"}</Text>
                </View>

                <View style={s.bottomRow}>
                    <Text style={s.price}>{rupee(p.price)}</Text>
                    
                    {qty > 0 ? (
                        <View style={s.stepperWrap}>
                            <Pressable
                                testID={`grocery-stepper-${p.id}-dec`}
                                onPress={() => onChange(qty - 1)}
                                hitSlop={6}
                                style={s.stepBtn}
                            >
                                <Ionicons name="remove" size={13} color="#EA580C" />
                            </Pressable>
                            <Text testID={`grocery-stepper-${p.id}-qty`} style={s.stepQty}>{qty}</Text>
                            <Pressable
                                testID={`grocery-stepper-${p.id}-inc`}
                                onPress={() => onChange(qty + 1)}
                                hitSlop={6}
                                style={s.stepBtn}
                            >
                                <Ionicons name="add" size={13} color="#EA580C" />
                            </Pressable>
                        </View>
                    ) : (
                        <Pressable
                            testID={`grocery-stepper-${p.id}`}
                            disabled={!p.available || busy}
                            onPress={() => onChange(1)}
                            hitSlop={4}
                            style={({ pressed }) => [
                                s.addBtn,
                                (!p.available || busy) && { opacity: 0.4 },
                                pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] },
                            ]}
                        >
                            <Text style={s.addBtnText}>ADD</Text>
                        </Pressable>
                    )}
                </View>
            </View>
        </Pressable>
    );
});

const useStyles = makeStyles((c) => ({
    card: {
        borderRadius: 14,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#F1F5F9",
        overflow: "hidden",
        position: "relative",
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.015,
        shadowRadius: 3,
        elevation: 0.8,
        marginBottom: 12,
        padding: 6,
    },
    imgWrap: {
        width: "100%",
        height: 104,
        position: "relative",
        borderRadius: 10,
        overflow: "hidden",
    },
    img: {
        width: "100%",
        height: "100%",
        borderRadius: 10,
    },
    badge: {
        position: "absolute",
        left: 8,
        top: 8,
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    badgeText: {
        color: "#DC2626",
        fontSize: 10,
        fontWeight: "800",
    },
    contentWrap: {
        paddingHorizontal: 6,
        paddingTop: 8,
        paddingBottom: 4,
        gap: 4,
    },
    name: {
        color: "#0F172A",
        fontWeight: "800",
        fontSize: 14,
        letterSpacing: -0.2,
    },
    storeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 1,
    },
    store: {
        color: "#64748B",
        fontSize: 11.5,
        fontWeight: "500",
        flex: 1,
    },
    bottomRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 8,
    },
    price: {
        color: "#0F172A",
        fontWeight: "900",
        fontSize: 15,
        letterSpacing: -0.3,
    },
    addBtn: {
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "rgba(252, 128, 25, 0.45)",
        paddingHorizontal: 16,
        paddingVertical: 5,
        borderRadius: radius.pill,
        minWidth: 64,
        alignItems: "center",
        justifyContent: "center",
    },
    addBtnText: {
        color: "#EA580C",
        fontSize: 12,
        fontWeight: "900",
        letterSpacing: 0.4,
    },
    stepperWrap: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "rgba(252, 128, 25, 0.45)",
        borderRadius: radius.pill,
        paddingHorizontal: 4,
        height: 28,
        minWidth: 72,
    },
    stepBtn: {
        width: 22,
        height: 24,
        alignItems: "center",
        justifyContent: "center",
    },
    stepQty: {
        color: "#EA580C",
        fontWeight: "900",
        fontSize: 12,
        minWidth: 16,
        textAlign: "center",
    },
}));
