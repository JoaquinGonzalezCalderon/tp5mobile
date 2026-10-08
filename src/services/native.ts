import {NativeModules, PermissionsAndroid, Platform} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Geolocation from '@react-native-community/geolocation';
import {Location, NetworkInfo, ProbeResult} from '../types';

type NativeQoSModule = {
  getNetworkInfo?: () => Promise<NetworkInfo>;
  measureTcpProbes?: (hosts: string[], port: number, count: number) => Promise<ProbeResult[]>;
};

const nativeQoS = NativeModules.NetworkQoS as NativeQoSModule | undefined;

export async function getNetworkInfo(): Promise<NetworkInfo> {
  try {
    if (nativeQoS?.getNetworkInfo) return await nativeQoS.getNetworkInfo();
  } catch {
    // The JS fallback makes the screen usable while the native module is unavailable.
  }
  const state = await NetInfo.fetch();
  const details = state.details as {cellularGeneration?: string; carrier?: string; strength?: number; ipAddress?: string} | null;
  return {
    type: state.type === 'wifi' ? 'wifi' : state.type === 'cellular' ? 'cellular' : state.type === 'ethernet' ? 'ethernet' : 'unknown',
    carrier: details?.carrier,
    generation: details?.cellularGeneration,
    rssi: details?.strength,
    ipAddress: details?.ipAddress,
  };
}

export async function getCurrentLocation(): Promise<Location | null> {
  if (Platform.OS === 'android' && PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION) {
    const current = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    if (!current) {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      if (result !== PermissionsAndroid.RESULTS.GRANTED) return null;
    }
  }
  return new Promise(resolve => {
    Geolocation.getCurrentPosition(
      position => resolve({latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy}),
      () => resolve(null),
      {enableHighAccuracy: false, timeout: 8000, maximumAge: 120000},
    );
  });
}

export async function measureTcpProbes(hosts: string[], port = 80, count = 4): Promise<ProbeResult[]> {
  if (nativeQoS?.measureTcpProbes) {
    try {
      return await nativeQoS.measureTcpProbes(hosts, port, count);
    } catch {
      // Fall through to HTTP probes on platforms where the custom module is not linked.
    }
  }
  return Promise.all(hosts.map(host => httpProbe(host, count)));
}

async function httpProbe(host: string, count: number): Promise<ProbeResult> {
  const samples: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const started = Date.now();
    try {
      const protocol = Platform.OS === 'android' ? 'http' : 'https';
      await fetch(`${protocol}://${host}/?qos=${Date.now()}-${index}`, {method: 'HEAD'});
      samples.push(Date.now() - started);
    } catch {
      // A failed probe is represented by packet loss and does not pollute RTT statistics.
    }
  }
  return summarizeProbe(host, samples, count);
}

export function summarizeProbe(host: string, samples: number[], total: number): ProbeResult {
  if (!samples.length) return {host, min: 0, avg: 0, max: 0, jitter: 0, loss: 100, samples: []};
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const avg = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const jitter = samples.length < 2 ? 0 : samples.slice(1).reduce((sum, value, index) => sum + Math.abs(value - (samples[index] ?? value)), 0) / (samples.length - 1);
  return {host, min, avg: round(avg), max, jitter: round(jitter), loss: round(((total - samples.length) / total) * 100), samples};
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
