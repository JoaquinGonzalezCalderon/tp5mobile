import {Measurement, Settings, ThroughputResult} from '../types';
import {getCurrentLocation, getNetworkInfo, measureTcpProbes} from './native';
import {classifyQuality, correctedMbps} from './stats';

const DOWNLOAD_BYTES = 2 * 1024 * 1024;
const UPLOAD_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT = 20000;

/** Motor de medición: red + ubicación + sondas RTT en paralelo, después throughput (que satura el enlace). */
export async function runMeasurement(settings: Settings, sessionId: string, trigger: Measurement['trigger']): Promise<Measurement> {
  const [network, location, probes] = await Promise.all([
    getNetworkInfo(),
    getCurrentLocation(),
    measureTcpProbes(settings.hosts, settings.probePort, settings.probeCount),
  ]);
  const throughput = await measureThroughput(settings.backendUrl);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    timestamp: new Date().toISOString(),
    network,
    location,
    probes,
    throughput,
    quality: classifyQuality(probes, throughput),
    backend: settings.backendUrl,
    trigger,
  };
}

export async function measureThroughput(baseUrl: string): Promise<ThroughputResult> {
  const base = baseUrl.replace(/\/$/, '');
  const started = Date.now();
  const baseLatencyMs = await measureBaseLatency(base);

  let download = 0;
  let downloadBytes = 0;
  try {
    const t0 = Date.now();
    const response = await fetchWithTimeout(`${base}/download/${DOWNLOAD_BYTES}?t=${t0}`);
    const buffer = await response.arrayBuffer();
    downloadBytes = buffer.byteLength;
    download = correctedMbps(downloadBytes, Date.now() - t0, baseLatencyMs);
  } catch {
    download = 0;
  }

  let upload = 0;
  let uploadBytes = 0;
  try {
    const payload = 'q'.repeat(UPLOAD_BYTES);
    const t0 = Date.now();
    const response = await fetchWithTimeout(`${base}/upload`, {method: 'POST', headers: {'Content-Type': 'application/octet-stream'}, body: payload});
    uploadBytes = Number(response.headers.get('x-bytes-received') ?? payload.length);
    upload = correctedMbps(uploadBytes, Date.now() - t0, baseLatencyMs);
  } catch {
    upload = 0;
  }
  return {download, upload, downloadBytes, uploadBytes, baseLatencyMs, durationMs: Date.now() - started};
}

/** Mediana de 3 peticiones mínimas: el costo fijo (conexión + TTFB) que se descuenta de cada transferencia. */
async function measureBaseLatency(base: string): Promise<number> {
  const samples: number[] = [];
  for (let index = 0; index < 3; index += 1) {
    const t0 = Date.now();
    try {
      await fetchWithTimeout(`${base}/health?t=${t0}`);
      samples.push(Date.now() - t0);
    } catch {
      // ignorado
    }
  }
  if (!samples.length) return 0;
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)] ?? 0;
}

function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  return fetch(url, {...init, signal: controller.signal}).finally(() => clearTimeout(timeout));
}
