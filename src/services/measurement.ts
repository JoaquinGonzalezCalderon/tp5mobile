import {Location, Measurement, NetworkInfo, ProbeResult, ThroughputResult} from '../types';
import {getCurrentLocation, getNetworkInfo, measureTcpProbes} from './native';

const DOWNLOAD_BYTES = 512 * 1024;
const REQUEST_TIMEOUT = 12000;

export async function runMeasurement(settings: {backendUrl: string; hosts: string[]}): Promise<Measurement> {
  const [network, location, probes] = await Promise.all([
    getNetworkInfo(),
    getCurrentLocation(),
    measureTcpProbes(settings.hosts),
  ]);
  const throughput = await measureThroughput(settings.backendUrl);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    network,
    location,
    probes,
    throughput,
    quality: classifyQuality(probes, throughput),
    backend: settings.backendUrl,
  };
}

export async function measureThroughput(baseUrl: string): Promise<ThroughputResult> {
  const base = baseUrl.replace(/\/$/, '');
  const downloadStarted = Date.now();
  let download = 0;
  try {
    const response = await fetchWithTimeout(`${base}/download/${DOWNLOAD_BYTES}?t=${Date.now()}`);
    const buffer = await response.arrayBuffer();
    download = megabits(buffer.byteLength, Date.now() - downloadStarted);
  } catch {
    download = 0;
  }
  const payload = 'q'.repeat(128 * 1024);
  const uploadStarted = Date.now();
  let upload = 0;
  try {
    const response = await fetchWithTimeout(`${base}/upload`, {method: 'POST', headers: {'Content-Type': 'application/octet-stream'}, body: payload});
    const echoedBytes = Number(response.headers.get('x-bytes-received') ?? payload.length);
    upload = megabits(echoedBytes, Date.now() - uploadStarted);
  } catch {
    upload = 0;
  }
  return {download: round(download), upload: round(upload), durationMs: Date.now() - downloadStarted};
}

function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  return fetch(url, {...init, signal: controller.signal}).finally(() => clearTimeout(timeout));
}

function megabits(bytes: number, milliseconds: number): number {
  if (milliseconds <= 0) return 0;
  return (bytes * 8) / (milliseconds / 1000) / 1_000_000;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function classifyQuality(probes: ProbeResult[], throughput: ThroughputResult): Measurement['quality'] {
  const primary = probes.find(item => item.loss < 100) ?? probes[0];
  if (!primary || primary.loss > 20 || (primary.avg > 250 && primary.avg > 0)) return 'poor';
  if (primary.loss > 5 || primary.avg > 120 || throughput.download < 2) return 'fair';
  if (primary.avg > 60 || throughput.download < 10) return 'good';
  return 'excellent';
}
