import { Pressable, Text, View } from "react-native";

import { mediaUri, rupee } from "@/src/format";
import { font, makeStyles, radius, spacing } from "@/src/theme";
import { Product } from "@/src/types";
import { AppImage, Stepper } from "@/src/ui";

/** Compact grocery product card: image, name, pack info, store and price with an add stepper. */
export function GroceryCard({ p, qty, busy, onChange, onOpen, width }: {
    p: Product; qty: number; busy: boolean; onChange: (n: number) => void; onOpen: () => void; width: number;
}) {
    const s = useStyles();
    const low = p.available && p.stock < 10;
    return (
        <Pressable testID={`grocery-product-${p.id}`} onPress={onOpen} style={[s.card, { width }]}>
            <View style={s.imgWrap}>
                <AppImage source={{ uri: mediaUri(p.image) }} fallbackType="groceries" style={s.img} contentFit="cover" transition={150} />
                {!p.available ? <View style={s.badge}><Text style={s.badgeText}>Out of stock</Text></View> : low ? <View style={s.badge}><Text style={s.badgeText}>Only {p.stock} left</Text></View> : null}
            </View>
            <Text style={s.name} numberOfLines={2}>{p.name}</Text>
            <Text style={s.store} numberOfLines={1}>{p.seller_name}</Text>
            <View style={s.row}>
                <Text style={s.price}>{rupee(p.price)}</Text>
                <Stepper testID={`grocery-stepper-${p.id}`} qty={qty} disabled={!p.available || busy} onChange={onChange} />
            </View>
        </Pressable>
    );
}

const useStyles = makeStyles((c) => ({
    card: { backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.sm, gap: 4 },
    imgWrap: { borderRadius: radius.sm, overflow: "hidden", backgroundColor: c.surfaceTertiary },
    img: { width: "100%", aspectRatio: 1.15 },
    badge: { position: "absolute", left: 6, top: 6, backgroundColor: c.surface, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
    badgeText: { color: c.error, fontSize: 10, fontWeight: "800" },
    name: { color: c.onSurface, fontWeight: "700", fontSize: font.sm + 1, minHeight: 34, marginTop: 4 },
    store: { color: c.muted, fontSize: font.sm - 1 },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4, gap: spacing.xs },
    price: { color: c.onSurface, fontWeight: "900", fontSize: font.base },
}));
