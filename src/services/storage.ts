import AsyncStorage from '@react-native-async-storage/async-storage';
import {Measurement, Settings} from '../types';

const MEASUREMENTS_KEY = '@network-qos/measurements';
const SETTINGS_KEY = '@network-qos/settings';

export const defaultSettings: Settings = {
  backendUrl: 'http://10.0.2.2:3333',
  hosts: ['1.1.1.1', '8.8.8.8', 'google.com'],
  intervalMinutes: 15,
  backgroundEnabled: false,
};

export async function loadMeasurements(): Promise<Measurement[]> {
  const raw = await AsyncStorage.getItem(MEASUREMENTS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Measurement[];
  } catch {
    return [];
  }
}

export async function saveMeasurement(measurement: Measurement): Promise<Measurement[]> {
  const current = await loadMeasurements();
  const updated = [measurement, ...current].slice(0, 500);
  await AsyncStorage.setItem(MEASUREMENTS_KEY, JSON.stringify(updated));
  return updated;
}

export async function loadSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) return defaultSettings;
  try {
    return {...defaultSettings, ...(JSON.parse(raw) as Partial<Settings>)};
  } catch {
    return defaultSettings;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function exportMeasurements(measurements: Measurement[], format: 'json' | 'csv'): Promise<string> {
  if (format === 'json') return JSON.stringify(measurements, null, 2);
  const headers = ['timestamp', 'network', 'operator', 'rssi', 'latitude', 'longitude', 'rtt_avg_ms', 'jitter_ms', 'packet_loss_pct', 'download_mbps', 'upload_mbps', 'quality'];
  const rows = measurements.map(item => [
    item.timestamp,
    item.network.type,
    item.network.carrier ?? '',
    item.network.rssi ?? '',
    item.location?.latitude ?? '',
    item.location?.longitude ?? '',
    item.probes[0]?.avg ?? '',
    item.probes[0]?.jitter ?? '',
    item.probes[0]?.loss ?? '',
    item.throughput.download,
    item.throughput.upload,
    item.quality,
  ].map(value => `"${String(value).replaceAll('"', '""')}"`).join(','));
  return [headers.join(','), ...rows].join('\n');
}
