import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";

import { api } from "@/src/api";
import { LatLng, OsmMap, OsmMapHandle } from "@/src/components/osm-map";
import { currentPosition, LocationExplainSheet, useLocationAccess } from "@/src/location";
import { font, makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, Chip, Header, Input, Ionicons, useToast } from "@/src/ui";

const DEFAULT = { lat: 12.9352, lng: 77.6245 }; // Koramangala, Bengaluru
type Place = { line: string; area: string };
type Hit = LatLng & { name: string; line: string };

export default function NewAddress() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const map = useRef<OsmMapHandle>(null);
  const loc = useLocationAccess();
  const [step, setStep] = useState<"map" | "details">("map");
  const [point, setPoint] = useState<LatLng>(DEFAULT);
  const [place, setPlace] = useState<Place | null>(null);
  const [moving, setMoving] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [house, setHouse] = useState("");
  const [landmark, setLandmark] = useState("");
  const [label, setLabel] = useState("Home");
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  // Reverse-geocode wherever the pin settles.
  useEffect(() => {
    const n = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const r = await api<Place>(`/geo/reverse?lat=${point.lat}&lng=${point.lng}`);
        if (n === seq.current) setPlace(r);
      } catch {
        if (n === seq.current) setPlace({ line: "", area: "Pinned location" });
      }
    }, 450);
    return () => clearTimeout(t);
  }, [point]);

  // Search places as the user types.
  useEffect(() => {
    if (query.trim().length < 3) { setHits([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try { setHits(await api<Hit[]>(`/geo/search?q=${encodeURIComponent(query.trim())}&lat=${point.lat}&lng=${point.lng}`)); } catch (e: any) { toast(e.message, "err"); } finally { setSearching(false); }
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, toast]);

  // If location is already allowed, start at the user's position (no prompt on open).
  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(async (p) => {
      if (!p.granted) return;
      try { const c = await currentPosition(); map.current?.setCenter(c, 17); setPoint(c); } catch {}
    });
  }, []);

  const goTo = (c: LatLng) => { map.current?.setCenter(c, 17); setPoint(c); setPlace(null); };
  const locate = async () => {
    setLocating(true);
    try { goTo(await currentPosition()); } catch { toast("Couldn't get your location. Move the map to your spot instead.", "err"); } finally { setLocating(false); }
  };
  const useMyLocation = async () => { if (await loc.ensure()) locate(); };

  const save = async () => {
    if (house.trim().length < 1) return toast("Enter your flat / house number", "err");
    const line = [house.trim(), place?.line].filter(Boolean).join(", ");
    if (line.length < 5) return toast("Add a few more address details", "err");
    setBusy(true);
    try {
      await api("/addresses", { method: "POST", body: { label, line, landmark: landmark.trim(), lat: point.lat, lng: point.lng, is_default: true } });
      qc.invalidateQueries({ queryKey: ["addresses"] });
      toast("Address saved");
      if (router.canGoBack()) router.back(); else router.replace("/addresses");
    } catch (e: any) {
      toast(e.message, "err");
    } finally {
      setBusy(false);
    }
  };

  if (step === "details") {
    return (
      <View style={s.root}>
        <Header title="Address details" />
        <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
          <View style={s.summary}>
            <Ionicons name="location" size={22} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={s.area}>{place?.area || "Pinned location"}</Text>
              <Text style={s.sub} numberOfLines={2}>{place?.line || `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`}</Text>
            </View>
            <Pressable testID="address-change-pin" hitSlop={10} onPress={() => setStep("map")}><Text style={s.link}>Change</Text></Pressable>
          </View>
          <Input testID="address-house-input" label="Flat / house no., floor, building" placeholder="Flat 302, Green Meadows" value={house} onChangeText={setHouse} />
          <Input testID="address-landmark-input" label="Landmark (optional)" placeholder="Near Forum Mall" value={landmark} onChangeText={setLandmark} />
          <View style={{ gap: spacing.sm }}>
            <Text style={s.label}>Save as</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
              {["Home", "Work", "PG", "Other"].map((l) => <Chip key={l} testID={`address-label-${l}`} label={l} selected={label === l} onPress={() => setLabel(l)} />)}
            </View>
          </View>
          <Button testID="address-save-button" title="Save address" loading={busy} onPress={save} />
        </KeyboardAwareScrollView>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <Header title="Select delivery location" />
      <View style={{ flex: 1 }}>
        <OsmMap ref={map} testID="address-map" center={DEFAULT} zoom={16} picker
          onMoveStart={() => { setMoving(true); setHits([]); }}
          onMove={(c) => {
            setMoving(false);
            // Leaflet fires several moveends on load; only a real change of centre needs a new lookup.
            setPoint((p) => (Math.abs(p.lat - c.lat) < 1e-6 && Math.abs(p.lng - c.lng) < 1e-6 ? p : (setPlace(null), c)));
          }} />
        <View style={s.searchWrap}>
          <View style={s.search}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput testID="address-search-input" value={query} onChangeText={setQuery} placeholder="Search area, street or apartment" placeholderTextColor={colors.muted}
              style={s.searchInput} returnKeyType="search" />
            {searching ? <ActivityIndicator size="small" color={colors.brandPrimary} /> : query ? (
              <Pressable testID="address-search-clear" hitSlop={10} onPress={() => { setQuery(""); setHits([]); }}><Ionicons name="close-circle" size={18} color={colors.muted} /></Pressable>
            ) : null}
          </View>
          {hits.length ? (
            <View style={s.hits} testID="address-search-results">
              {hits.map((h, i) => (
                <Pressable key={`${h.lat}-${h.lng}-${i}`} testID={`address-search-hit-${i}`} style={s.hit} onPress={() => { setQuery(""); setHits([]); goTo(h); }}>
                  <Ionicons name="location-outline" size={18} color={colors.brandPrimary} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.onSurface, fontWeight: "700" }} numberOfLines={1}>{h.name}</Text>
                    <Text style={s.sub} numberOfLines={1}>{h.line}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
        <Pressable testID="address-use-my-location" onPress={useMyLocation} style={s.locBtn}>
          {locating ? <ActivityIndicator size="small" color={colors.brandPrimary} /> : <Ionicons name="locate" size={18} color={colors.brandPrimary} />}
          <Text style={{ color: colors.brandPrimary, fontWeight: "800" }}>Use my location</Text>
        </Pressable>
      </View>
      <View style={[s.card, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Text style={s.hint}>Move the map to place the pin on your door</Text>
        <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
          <Ionicons name="location" size={24} color={colors.brandPrimary} />
          <View style={{ flex: 1 }}>
            {moving || !place ? <Text testID="address-locating" style={s.area}>Locating…</Text> : (
              <>
                <Text testID="address-place-area" style={s.area}>{place.area || "Pinned location"}</Text>
                <Text testID="address-place-line" style={s.sub} numberOfLines={2}>{place.line || `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`}</Text>
              </>
            )}
          </View>
        </View>
        <Button testID="address-confirm-location" title="Confirm location" disabled={moving || !place} onPress={() => setStep("details")} />
      </View>
      <LocationExplainSheet mode={loc.explain} onClose={loc.close} title="Find you on the map"
        body="Allow location to drop the pin right at your door, so your rider finds you without calls."
        onAllow={async () => { if (await loc.request()) locate(); }} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  searchWrap: { position: "absolute", top: spacing.md, left: spacing.md, right: spacing.md, gap: spacing.sm },
  search: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 48,
    borderWidth: 1, borderColor: c.border, shadowColor: c.onSurface, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  searchInput: { flex: 1, color: c.onSurface, fontSize: font.base, height: 48 },
  hits: { backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, overflow: "hidden", elevation: 3 },
  hit: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider, minHeight: 48 },
  locBtn: { position: "absolute", bottom: spacing.lg, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.surface,
    borderRadius: radius.pill, paddingHorizontal: spacing.lg, height: 44, borderWidth: 1, borderColor: c.brandPrimary, elevation: 3 },
  card: { backgroundColor: c.surface, padding: spacing.lg, gap: spacing.md, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderTopWidth: 1, borderColor: c.border },
  hint: { color: c.muted, fontSize: font.sm, fontWeight: "600" },
  area: { color: c.onSurface, fontWeight: "800", fontSize: font.lg },
  sub: { color: c.muted, fontSize: font.sm + 1 },
  summary: { flexDirection: "row", gap: spacing.md, alignItems: "center", backgroundColor: c.brandTertiary, borderRadius: radius.md, padding: spacing.md },
  link: { color: c.brandPrimary, fontWeight: "800" },
  label: { color: c.onSurfaceSecondary, fontWeight: "700", fontSize: font.sm + 1 },
}));
