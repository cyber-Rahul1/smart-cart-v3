import { Ref, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";

import { MapCommand, mapHtml, MapEvent, OsmMapHandle, OsmMapProps } from "@/src/components/map-html";
import { CenterPin } from "@/src/components/map-pin";
import { useTheme } from "@/src/theme";

export type { LatLng, MapMarker, OsmMapHandle } from "@/src/components/map-html";

export function OsmMap({ ref, ...p }: OsmMapProps & { ref?: Ref<OsmMapHandle> }) {
  const { colors } = useTheme();
  const web = useRef<WebView>(null);
  const ready = useRef(false);
  const id = useMemo(() => Math.random().toString(36).slice(2), []);
  // Built once; later changes are pushed as commands so the map never reloads.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => mapHtml(id, p, colors), [id]);
  const queue = useRef<MapCommand[]>([]);
  const send = (cmd: MapCommand) => web.current?.injectJavaScript(`window.handle(${JSON.stringify(cmd)});true;`);
  // Commands issued before the page loads are replayed once it reports ready.
  const post = (cmd: MapCommand) => (ready.current ? send(cmd) : queue.current.push(cmd));

  useImperativeHandle(ref, () => ({ setCenter: (c, zoom) => post({ type: "center", ...c, zoom }) }));
  const markersKey = JSON.stringify(p.markers ?? []);
  useEffect(() => {
    post({ type: "markers", markers: p.markers ?? [], fit: p.fitMarkers, route: p.route });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markersKey]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const m = JSON.parse(e.nativeEvent.data) as MapEvent;
      if (m.type === "ready") { ready.current = true; queue.current.splice(0).forEach(send); }
      else if (m.type === "movestart") p.onMoveStart?.();
      else if (m.type === "move") p.onMove?.({ lat: m.lat, lng: m.lng });
    } catch {}
  };

  return (
    <View style={{ flex: 1, overflow: "hidden" }} testID={p.testID}>
      <WebView ref={web} originWhitelist={["*"]} source={{ html, baseUrl: "https://gathrcart.app/" }} onMessage={onMessage} style={{ flex: 1, backgroundColor: colors.surfaceTertiary }}
        javaScriptEnabled domStorageEnabled scrollEnabled={false} />
      {p.picker ? <CenterPin /> : null}
    </View>
  );
}
