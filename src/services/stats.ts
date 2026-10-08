import {DatePreset, Location, Measurement, ProbeResult, QoSStatus, ThroughputResult} from '../types';

export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Resume las muestras RTT de un host. El jitter es la variación media entre muestras consecutivas (RFC 3550). */
export function summarizeProbe(host: string, samples: number[], total: number): ProbeResult {
  if (!samples.length || total <= 0) return {host, min: 0, avg: 0, max: 0, jitter: 0, loss: 100, samples: []};
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const avg = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  let jitter = 0;
  for (let index = 1; index < samples.length; index += 1) jitter += Math.abs((samples[index] ?? 0) - (samples[index - 1] ?? 0));
  jitter = samples.length > 1 ? jitter / (samples.length - 1) : 0;
  return {
    host,
    min: round(min),
    avg: round(avg),
    max: round(max),
    jitter: round(jitter),
    loss: round(((total - samples.length) / total) * 100),
    samples: samples.map(value => round(value)),
  };
}

/**
 * Mbps de una transferencia descontando la latencia base (handshake + TTFB), de modo que
 * payloads chicos no subestimen el throughput. Nunca descuenta más del 80 % del tiempo medido.
 */
export function correctedMbps(bytes: number, elapsedMs: number, baseLatencyMs: number): number {
  if (bytes <= 0 || elapsedMs <= 0) return 0;
  const transferMs = Math.max(elapsedMs - baseLatencyMs, elapsedMs * 0.2);
  return round((bytes * 8) / (transferMs / 1000) / 1_000_000);
}

/** Host de referencia: el primero que respondió, para no clasificar con un host caído. */
export function primaryProbe(probes: ProbeResult[]): ProbeResult | undefined {
  return probes.find(item => item.loss < 100) ?? probes[0];
}

export function aggregateProbes(probes: ProbeResult[]): {avg: number; jitter: number; loss: number} {
  const alive = probes.filter(item => item.loss < 100);
  if (!alive.length) return {avg: 0, jitter: 0, loss: probes.length ? 100 : 0};
  return {
    avg: round(alive.reduce((sum, item) => sum + item.avg, 0) / alive.length),
    jitter: round(alive.reduce((sum, item) => sum + item.jitter, 0) / alive.length),
    loss: round(probes.reduce((sum, item) => sum + item.loss, 0) / probes.length),
  };
}

export function classifyQuality(probes: ProbeResult[], throughput: Pick<ThroughputResult, 'download'>): QoSStatus {
  const {avg, jitter, loss} = aggregateProbes(probes);
  if (!probes.length || loss >= 20 || avg > 250 || (avg === 0 && loss === 100)) return 'poor';
  if (loss > 5 || avg > 120 || jitter > 40 || throughput.download < 2) return 'fair';
  if (avg > 60 || jitter > 15 || throughput.download < 10) return 'good';
  return 'excellent';
}

/** Puntaje 0-1 usado como intensidad del heatmap. */
export function qualityScore(quality: QoSStatus): number {
  return {excellent: 1, good: 0.72, fair: 0.42, poor: 0.12}[quality];
}

export function haversineMeters(a: Location, b: Location): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earth = 6_371_000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(h));
}

/** Caja envolvente aproximada para prefiltrar en SQL antes del cálculo exacto por haversine. */
export function boundingBox(center: Location, radiusMeters: number) {
  const latDelta = radiusMeters / 111_320;
  const lngDelta = radiusMeters / (111_320 * Math.max(Math.cos((center.latitude * Math.PI) / 180), 0.01));
  return {
    minLat: center.latitude - latDelta,
    maxLat: center.latitude + latDelta,
    minLng: center.longitude - lngDelta,
    maxLng: center.longitude + lngDelta,
  };
}

export function dateFrom(preset: DatePreset, now = new Date()): number | null {
  if (preset === 'all') return null;
  if (preset === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = preset === '7d' ? 7 : 30;
  return now.getTime() - days * 24 * 60 * 60 * 1000;
}

const CSV_HEADERS = [
  'id', 'session_id', 'timestamp', 'trigger', 'network', 'generation', 'operator', 'rssi_dbm', 'latitude', 'longitude', 'accuracy_m',
  'rtt_avg_ms', 'rtt_min_ms', 'rtt_max_ms', 'jitter_ms', 'packet_loss_pct', 'download_mbps', 'upload_mbps', 'quality', 'hosts',
];

export function toCsv(measurements: Measurement[]): string {
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = measurements.map(item => {
    const agg = aggregateProbes(item.probes);
    const mins = item.probes.filter(p => p.loss < 100).map(p => p.min);
    const maxs = item.probes.filter(p => p.loss < 100).map(p => p.max);
    return [
      item.id, item.sessionId, item.timestamp, item.trigger, item.network.type, item.network.generation, item.network.carrier, item.network.rssi,
      item.location?.latitude, item.location?.longitude, item.location?.accuracy,
      agg.avg, mins.length ? Math.min(...mins) : '', maxs.length ? Math.max(...maxs) : '', agg.jitter, agg.loss,
      item.throughput.download, item.throughput.upload, item.quality, item.probes.map(p => p.host).join(' '),
    ].map(escape).join(',');
  });
  return [CSV_HEADERS.join(','), ...rows].join('\n');
}

export function networkLabel(network: Measurement['network'] | undefined): string {
  if (!network) return 'Sin medir';
  if (network.type === 'wifi') return 'Wi-Fi';
  if (network.type === 'cellular') return network.generation ?? 'Celular';
  if (network.type === 'ethernet') return 'Ethernet';
  if (network.type === 'none') return 'Sin conexión';
  return 'Desconocida';
}
