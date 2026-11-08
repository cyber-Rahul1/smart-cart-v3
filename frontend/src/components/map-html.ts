import type { ThemeColors } from "@/src/theme";

export type LatLng = { lat: number; lng: number };
export type MapMarker = LatLng & { id: string; kind: "shop" | "home" | "rider" };
export type MapCommand =
  | { type: "center"; lat: number; lng: number; zoom?: number }
  | { type: "markers"; markers: MapMarker[]; fit?: boolean; route?: boolean };
export type MapEvent = { type: "ready" } | { type: "movestart" } | ({ type: "move" } & LatLng);

export type OsmMapProps = {
  center: LatLng;
  zoom?: number;
  markers?: MapMarker[];
  fitMarkers?: boolean;
  route?: boolean;
  picker?: boolean;
  onMove?: (p: LatLng) => void;
  onMoveStart?: () => void;
  testID?: string;
};
export type OsmMapHandle = { setCenter: (p: LatLng, zoom?: number) => void };

const ICON: Record<MapMarker["kind"], string> = {
  // Simple inline SVG glyphs: storefront, home and scooter.
  shop: '<path d="M4 10h16v10H4z M3 4h18l1 6H2z" fill="#fff"/>',
  home: '<path d="M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z" fill="#fff"/>',
  rider: '<circle cx="6" cy="17" r="3" fill="#fff"/><circle cx="18" cy="17" r="3" fill="#fff"/><path d="M6 17l4-7h5l3 7" stroke="#fff" stroke-width="2" fill="none"/>',
};

/** Leaflet + OpenStreetMap tiles page, shared by the native WebView and the web iframe. */
export function mapHtml(id: string, p: OsmMapProps, colors: ThemeColors) {
  const cfg = {
    id, center: p.center, zoom: p.zoom ?? 15, markers: p.markers ?? [], fit: !!p.fitMarkers, route: !!p.route, picker: !!p.picker,
    colors: { shop: colors.brandPrimary, home: colors.success, rider: colors.surfaceInverse, line: colors.brandPrimary },
    icons: ICON,
  };
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{margin:0;padding:0;height:100%;width:100%;background:${colors.surfaceTertiary}}
.pin{width:34px;height:34px;border-radius:17px;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center}
.leaflet-control-attribution{font-size:9px}</style></head><body><div id="m"></div><script>
var C=${JSON.stringify(cfg)};
function send(m){m.mapId=C.id;var s=JSON.stringify(m);if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(s)}else{parent.postMessage(s,"*")}}
var map=L.map("m",{zoomControl:false}).setView([C.center.lat,C.center.lng],C.zoom);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap contributors"}).addTo(map);
var layer=L.layerGroup().addTo(map),line=null;
function icon(k){return L.divIcon({className:"",iconSize:[34,34],iconAnchor:[17,17],html:'<div class="pin" style="background:'+C.colors[k]+'"><svg width="18" height="18" viewBox="0 0 24 24">'+C.icons[k]+'</svg></div>'})}
function setMarkers(ms,fit,route){layer.clearLayers();var pts=[];ms.forEach(function(m){pts.push([m.lat,m.lng]);L.marker([m.lat,m.lng],{icon:icon(m.kind)}).addTo(layer)});
if(route&&pts.length>1){L.polyline(pts,{color:C.colors.line,weight:4,dashArray:"8 8",opacity:.8}).addTo(layer)}
if(fit&&pts.length>1){map.fitBounds(pts,{padding:[48,48],maxZoom:16})}else if(fit&&pts.length===1){map.setView(pts[0],15)}}
window.handle=function(c){if(c.type==="center"){map.setView([c.lat,c.lng],c.zoom||map.getZoom())}else if(c.type==="markers"){setMarkers(c.markers,c.fit,c.route)}};
window.addEventListener("message",function(e){try{var d=typeof e.data==="string"?JSON.parse(e.data):e.data;if(d&&d.target===C.id){window.handle(d.cmd)}}catch(_){}});
if(C.picker){map.on("movestart",function(){send({type:"movestart"})});map.on("moveend",function(){var c=map.getCenter();send({type:"move",lat:c.lat,lng:c.lng})})}
setMarkers(C.markers,C.fit,C.route);send({type:"ready"});
</script></body></html>`;
}
