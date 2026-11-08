import { createElement, Ref, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { View } from "react-native";

import { MapCommand, mapHtml, MapEvent, OsmMapHandle, OsmMapProps } from "@/src/components/map-html";
import { CenterPin } from "@/src/components/map-pin";
import { useTheme } from "@/src/theme";

export type { LatLng, MapMarker, OsmMapHandle } from "@/src/components/map-html";

/** Web preview: the same Leaflet page rendered in an iframe, bridged with postMessage. */
export function OsmMap({ ref, ...p }: OsmMapProps & { ref?: Ref<OsmMapHandle> }) {
  const { colors } = useTheme();
  const frame = useRef<any>(null);
  const ready = useRef(false);
  const id = useMemo(() => Math.random().toString(36).slice(2), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => mapHtml(id, p, colors), [id]);
  const handlers = useRef(p);
  handlers.current = p;
  const queue = useRef<MapCommand[]>([]);
  const send = (cmd: MapCommand) => frame.current?.contentWindow?.postMessage(JSON.stringify({ target: id, cmd }), "*");
  // Commands issued before the page loads are replayed once it reports ready.
  const post = (cmd: MapCommand) => (ready.current ? send(cmd) : queue.current.push(cmd));

  useImperativeHandle(ref, () => ({ setCenter: (c, zoom) => post({ type: "center", ...c, zoom }) }));
  const markersKey = JSON.stringify(p.markers ?? []);
  useEffect(() => {
    post({ type: "markers", markers: p.markers ?? [], fit: p.fitMarkers, route: p.route });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markersKey]);

  useEffect(() => {
    const listen = (e: MessageEvent) => {
      try {
        const m = (typeof e.data === "string" ? JSON.parse(e.data) : e.data) as MapEvent & { mapId?: string };
        if (m?.mapId !== id) return;
        if (m.type === "ready") { ready.current = true; queue.current.splice(0).forEach(send); }
        else if (m.type === "movestart") handlers.current.onMoveStart?.();
        else if (m.type === "move") handlers.current.onMove?.({ lat: m.lat, lng: m.lng });
      } catch {}
    };
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, [id]);

  return (
    <View style={{ flex: 1, overflow: "hidden", backgroundColor: colors.surfaceTertiary }} testID={p.testID}>
      {createElement("iframe", { ref: frame, srcDoc: html, title: "map", style: { border: 0, width: "100%", height: "100%" } })}
      {p.picker ? <CenterPin /> : null}
    </View>
  );
}
