import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Text, View} from 'react-native';
import {WebView} from 'react-native-webview';
import {Measurement} from '../types';
import {colors} from '../theme';
import {aggregateProbes, networkLabel, qualityScore} from '../services/stats';

export type HeatMode = 'quality' | 'rssi' | 'rtt';

type MapPoint = {lat: number; lng: number; score: number; quality: string; label: string};

/**
 * Mapa de cobertura: Leaflet + leaflet.heat dentro de un WebView. Se eligió en lugar de
 * react-native-maps porque Google Maps exige una API key con facturación; el modelo de datos
 * (lat, lng, intensidad) es el mismo que usa el Heatmap overlay de react-native-maps.
 */
export function CoverageMap({measurements, height = 260, mode = 'quality', showMarkers = true}: {measurements: Measurement[]; height?: number; mode?: HeatMode; showMarkers?: boolean}) {
  const webView = useRef<WebView>(null);
  const [loaded, setLoaded] = useState(false);
  const points = useMemo(() => toPoints(measurements, mode), [measurements, mode]);
  const fitKey = measurements.filter(item => item.location).map(item => item.id).join(',');
  const payload = JSON.stringify({points, showMarkers, fitKey});
  const latestPayload = useRef(payload);
  latestPayload.current = payload;
  const inject = () => webView.current?.injectJavaScript(`window.render && window.render(${latestPayload.current}); true;`);

  useEffect(() => {
    if (loaded) inject();
  }, [loaded, payload]);

  return <View style={{height, borderRadius: 16, overflow: 'hidden', backgroundColor: '#DCEBFA', borderWidth: 1, borderColor: colors.border}}>
    <WebView
      ref={webView}
      originWhitelist={['*']}
      source={{html: MAP_HTML, baseUrl: 'https://localhost/'}}
      onLoadEnd={() => {
        setLoaded(true);
        // El WebView puede recargarse (p. ej. al volver a la app): siempre se reenvían los datos.
        inject();
      }}
      onMessage={event => {
        if (__DEV__) console.warn('[CoverageMap]', event.nativeEvent.data);
      }}
      javaScriptEnabled
      nestedScrollEnabled
      style={{backgroundColor: 'transparent'}}
    />
    {!points.length && <View pointerEvents="none" style={{position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center'}}>
      <View style={{backgroundColor: 'rgba(255,255,255,.92)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10}}>
        <Text style={{color: colors.muted, fontSize: 12, fontWeight: '600'}}>{mode === 'rssi' ? 'Sin mediciones con RSSI para mostrar' : 'Sin mediciones georreferenciadas todavía'}</Text>
      </View>
    </View>}
  </View>;
}

function toPoints(measurements: Measurement[], mode: HeatMode): MapPoint[] {
  return measurements.flatMap(item => {
    if (!item.location) return [];
    const agg = aggregateProbes(item.probes);
    let score = qualityScore(item.quality);
    if (mode === 'rssi') {
      if (item.network.rssi === undefined) return [];
      score = Math.min(Math.max((item.network.rssi + 120) / 70, 0.05), 1);
    } else if (mode === 'rtt') {
      if (agg.loss >= 100) score = 0.05;
      else score = Math.min(Math.max(1 - (agg.avg - 20) / 280, 0.05), 1);
    }
    const label = `<b>${networkLabel(item.network)}</b>${item.network.carrier ? ` · ${item.network.carrier}` : ''}<br/>${new Date(item.timestamp).toLocaleString()}<br/>RTT ${Math.round(agg.avg)} ms · ↓ ${item.throughput.download} Mbps · ↑ ${item.throughput.upload} Mbps${item.network.rssi !== undefined ? `<br/>RSSI ${item.network.rssi} dBm` : ''}`;
    return [{lat: item.location.latitude, lng: item.location.longitude, score, quality: item.quality, label}];
  });
}

const MAP_HTML = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
<style>
html,body,#map{margin:0;height:100%;background:#DCEBFA;font-family:sans-serif}
.legend{background:rgba(255,255,255,.92);padding:6px 8px;border-radius:8px;font-size:11px;color:#10233F;line-height:15px}
.legend i{display:inline-block;width:10px;height:10px;border-radius:5px;margin-right:4px;vertical-align:-1px}
</style></head><body><div id="map"></div><script>
var map = L.map('map', {zoomControl: true, attributionControl: true}).setView([-32.48, -58.23], 13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'}).addTo(map);
var heatLayers = [], markers = L.layerGroup().addTo(map), lastFitKey = null;
var colors = {excellent: '#14A77A', good: '#00B8D9', fair: '#E89A18', poor: '#D94A5B'};
var legend = L.control({position: 'bottomleft'});
legend.onAdd = function () { var d = L.DomUtil.create('div', 'legend'); d.innerHTML = '<i style="background:#14A77A"></i>Excelente <i style="background:#00B8D9"></i>Buena<br/><i style="background:#E89A18"></i>Regular <i style="background:#D94A5B"></i>Pobre'; return d; };
legend.addTo(map);
/* Promedia el puntaje por celda (~30 m) para que la densidad de mediciones no se confunda con calidad. */
function grid(points) {
  var cells = {};
  points.forEach(function (p) {
    var key = Math.round(p.lat / 0.0003) + ':' + Math.round(p.lng / 0.0003);
    var c = cells[key] || (cells[key] = {lat: 0, lng: 0, score: 0, n: 0});
    c.lat += p.lat; c.lng += p.lng; c.score += p.score; c.n += 1;
  });
  return Object.keys(cells).map(function (k) { var c = cells[k]; return {lat: c.lat / c.n, lng: c.lng / c.n, score: c.score / c.n}; });
}
function bucket(score) { return score >= 0.85 ? 'excellent' : score >= 0.57 ? 'good' : score >= 0.27 ? 'fair' : 'poor'; }
window.onerror = function (message) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage('error: ' + message); };
/* Una capa de calor por nivel, cada una de un solo color: el halo no cambia de color con el zoom
   y una zona buena nunca se ve roja en los bordes. maxZoom 0 desactiva la atenuación por zoom. */
window.render = function (data) {
  heatLayers.forEach(function (layer) { map.removeLayer(layer); });
  heatLayers = [];
  markers.clearLayers();
  var pts = data.points;
  if (!pts.length) return;
  var groups = {excellent: [], good: [], fair: [], poor: []};
  grid(pts).forEach(function (c) { groups[bucket(c.score)].push([c.lat, c.lng, 1]); });
  Object.keys(groups).forEach(function (key) {
    if (!groups[key].length) return;
    var gradient = {}; gradient[0.0] = colors[key]; gradient[1.0] = colors[key];
    heatLayers.push(L.heatLayer(groups[key], {radius: 34, blur: 26, maxZoom: 0, max: 1, minOpacity: 0.05, gradient: gradient}).addTo(map));
  });
  if (data.showMarkers) pts.forEach(function (p) {
    L.circleMarker([p.lat, p.lng], {radius: 5, color: '#fff', weight: 1.5, fillColor: colors[bucket(p.score)], fillOpacity: 1}).bindPopup(p.label).addTo(markers);
  });
  /* Reencuadra solo cuando cambia el conjunto de puntos (no al cambiar de modo). */
  if (data.fitKey !== lastFitKey) {
    var bounds = L.latLngBounds(pts.map(function (p) { return [p.lat, p.lng]; }));
    map.fitBounds(bounds.pad(0.3), {maxZoom: 16});
    lastFitKey = data.fitKey;
  }
};
</script></body></html>`;
