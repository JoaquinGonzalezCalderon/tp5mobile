import {NativeModules, PermissionsAndroid, Platform} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Geolocation from '@react-native-community/geolocation';
import notifee, {AuthorizationStatus} from '@notifee/react-native';
import {Location, NetworkInfo, ProbeResult} from '../types';
import {summarizeProbe} from './stats';

/** Contrato del módulo nativo propio (Kotlin: NetworkQoSModule.kt · Swift: NetworkQoSModule.swift). */
type NativeQoSModule = {
  getNetworkInfo: () => Promise<Omit<NetworkInfo, 'source'>>;
  measureTcpProbes: (hosts: string[], port: number, count: number) => Promise<ProbeResult[]>;
};

const nativeQoS = NativeModules.NetworkQoS as NativeQoSModule | undefined;

export const hasNativeModule = Boolean(nativeQoS?.getNetworkInfo);

/** Pide de una vez los permisos de ubicación, estado del teléfono y notificaciones. */
export async function requestPermissions(): Promise<void> {
  if (Platform.OS === 'android') {
    const wanted = [
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
    ].filter((item): item is NonNullable<typeof item> => Boolean(item));
    await PermissionsAndroid.requestMultiple(wanted);
  } else {
    Geolocation.requestAuthorization();
  }
  try {
    const settings = await notifee.getNotificationSettings();
    if (settings.authorizationStatus !== AuthorizationStatus.AUTHORIZED) await notifee.requestPermission();
  } catch {
    // Sin permiso de notificaciones la app sigue midiendo; solo no alerta.
  }
}

export async function getNetworkInfo(): Promise<NetworkInfo> {
  const state = await NetInfo.fetch();
  const details = state.details as {cellularGeneration?: string; carrier?: string; strength?: number; ipAddress?: string} | null;
  const fallback: NetworkInfo = {
    type: !state.isConnected ? 'none' : state.type === 'wifi' ? 'wifi' : state.type === 'cellular' ? 'cellular' : state.type === 'ethernet' ? 'ethernet' : 'unknown',
    carrier: details?.carrier ?? undefined,
    generation: details?.cellularGeneration ? details.cellularGeneration.toUpperCase() : undefined,
    ipAddress: details?.ipAddress ?? undefined,
    source: 'netinfo',
  };
  if (!nativeQoS?.getNetworkInfo) return fallback;
  try {
    const native = await nativeQoS.getNetworkInfo();
    // El módulo nativo aporta RSSI y generación real; NetInfo aporta la IP.
    return {...fallback, ...stripUndefined(native), ipAddress: fallback.ipAddress, source: 'native'};
  } catch {
    return fallback;
  }
}

export function getCurrentLocation(): Promise<Location | null> {
  return new Promise(resolve => {
    Geolocation.getCurrentPosition(
      position => resolve({latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy}),
      () => resolve(null),
      {enableHighAccuracy: true, timeout: 10000, maximumAge: 30000},
    );
  });
}

/**
 * Sondas RTT: el camino principal es el módulo nativo, que abre sockets TCP en un pool de hilos
 * propio y no bloquea el hilo JS. El fallback HTTP solo existe para plataformas sin el módulo.
 */
export async function measureTcpProbes(hosts: string[], port: number, count: number): Promise<ProbeResult[]> {
  if (nativeQoS?.measureTcpProbes) {
    try {
      return await nativeQoS.measureTcpProbes(hosts, port, count);
    } catch {
      // Sigue con el fallback.
    }
  }
  return Promise.all(hosts.map(host => httpProbe(host, port, count)));
}

async function httpProbe(host: string, port: number, count: number): Promise<ProbeResult> {
  const samples: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const started = Date.now();
    try {
      await fetch(`${port === 443 ? 'https' : 'http'}://${host}/?qos=${Date.now()}-${index}`, {method: 'HEAD'});
      samples.push(Date.now() - started);
    } catch {
      // Una sonda fallida cuenta como pérdida.
    }
  }
  return summarizeProbe(host, samples, count);
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null)) as Partial<T>;
}
