import * as Location from "expo-location";
import { useState } from "react";
import { Linking, Text } from "react-native";

import { useTheme } from "@/src/theme";
import { Button, Sheet } from "@/src/ui";

export type LocationAsk = "ask" | "settings" | null;

/** Foreground location permission with a pre-permission explanation and an Open Settings fallback. */
export function useLocationAccess() {
  const [explain, setExplain] = useState<LocationAsk>(null);
  const ensure = async () => {
    const p = await Location.getForegroundPermissionsAsync();
    if (p.granted) return true;
    setExplain(p.canAskAgain ? "ask" : "settings");
    return false;
  };
  const request = async () => {
    const p = await Location.requestForegroundPermissionsAsync();
    if (p.granted) { setExplain(null); return true; }
    setExplain(p.canAskAgain ? "ask" : "settings");
    return false;
  };
  return { explain, close: () => setExplain(null), ensure, request };
}

export async function currentPosition() {
  const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: p.coords.latitude, lng: p.coords.longitude };
}

export function LocationExplainSheet({ mode, onClose, onAllow, title, body }: { mode: LocationAsk; onClose: () => void; onAllow: () => void; title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <Sheet visible={!!mode} onClose={onClose} title={title} testID="location-permission-sheet">
      <Text style={{ color: colors.onSurfaceSecondary, lineHeight: 20 }}>{body}</Text>
      {mode === "settings" ? (
        <>
          <Text style={{ color: colors.muted }}>Location access is turned off for GathrCart. You can switch it on in Settings.</Text>
          <Button testID="location-open-settings" icon="settings-outline" title="Open Settings" onPress={() => { onClose(); Linking.openSettings(); }} />
        </>
      ) : (
        <Button testID="location-allow" icon="navigate" title="Allow location" onPress={onAllow} />
      )}
      <Button testID="location-not-now" variant="ghost" title="Not now" onPress={onClose} />
    </Sheet>
  );
}
