import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";

import { getAccessToken } from "@/src/api";
import { mediaUri } from "@/src/format";
import { font, radius, spacing, useTheme } from "@/src/theme";
import { Button, Sheet, useToast } from "@/src/ui";
import { uploadForm } from "@/src/utils/upload";

/** Pick a photo from the library (with a pre-permission explanation) and upload it to object storage. */
export function PhotoPicker({ url, onChange, testID, label = "Upload photo" }: { url: string | null; onChange: (u: string | null) => void; testID: string; label?: string }) {
  const { colors } = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [explain, setExplain] = useState<"ask" | "settings" | null>(null);

  const pickAndUpload = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [4, 3], quality: 0.7 });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setBusy(true);
    try {
      const token = await getAccessToken();
      const r = await uploadForm(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/seller/upload`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        files: { file: { uri: a.uri, name: a.fileName ?? "photo.jpg", mimeType: a.mimeType ?? "image/jpeg" } },
      });
      const text = await r.text();
      if (!r.ok) throw new Error((() => { try { return JSON.parse(text).detail; } catch { return "Upload failed"; } })());
      onChange(JSON.parse(text).url);
      toast("Photo uploaded");
    } catch (e: any) {
      toast(e.message || "Upload failed", "err");
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    const p = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (p.granted) return pickAndUpload();
    setExplain(p.canAskAgain ? "ask" : "settings");
  };

  const request = async () => {
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (p.granted) { setExplain(null); return pickAndUpload(); }
    setExplain(p.canAskAgain ? "ask" : "settings");
  };

  return (
    <View style={{ gap: spacing.sm }}>
      {url ? (
        <View>
          <Image testID={`${testID}-preview`} source={{ uri: mediaUri(url) }} style={{ width: "100%", height: 160, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary }} contentFit="cover" />
          <Pressable testID={`${testID}-remove`} onPress={() => onChange(null)} hitSlop={8}
            style={{ position: "absolute", top: spacing.sm, right: spacing.sm, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close" size={20} color={colors.onSurface} />
          </Pressable>
        </View>
      ) : null}
      <Pressable testID={testID} onPress={start} disabled={busy}
        style={{ minHeight: 52, borderRadius: radius.md, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary,
          flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm }}>
        {busy ? <ActivityIndicator color={colors.brandPrimary} /> : <Ionicons name="camera-outline" size={20} color={colors.brandPrimary} />}
        <Text style={{ color: colors.brandPrimary, fontWeight: "800", fontSize: font.base }}>{busy ? "Uploading…" : url ? "Change photo" : label}</Text>
      </Pressable>
      <Sheet visible={!!explain} onClose={() => setExplain(null)} title="Allow photo access" testID={`${testID}-permission-sheet`}>
        <Text style={{ color: colors.onSurfaceSecondary, lineHeight: 20 }}>
          {explain === "settings" ? "Photo access is turned off for GathrCart. Enable it in Settings to add real photos of your dishes and shop."
            : "GathrCart needs access to your photos so you can show customers real pictures of your dishes and shop."}
        </Text>
        {explain === "settings"
          ? <Button testID={`${testID}-open-settings`} title="Open Settings" onPress={() => { setExplain(null); Linking.openSettings(); }} />
          : <Button testID={`${testID}-allow`} title="Continue" onPress={request} />}
        <Button testID={`${testID}-not-now`} variant="ghost" title="Not now" onPress={() => setExplain(null)} />
      </Sheet>
    </View>
  );
}
