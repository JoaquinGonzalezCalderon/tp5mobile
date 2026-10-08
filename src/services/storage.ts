import AsyncStorage from '@react-native-async-storage/async-storage';
import {Settings} from '../types';

const SETTINGS_KEY = '@network-qos/settings';
const ACTIVE_SESSION_KEY = '@network-qos/active-session';

export const defaultSettings: Settings = {
  backendUrl: 'http://10.0.2.2:3333',
  hosts: ['1.1.1.1', '8.8.8.8', 'google.com'],
  probePort: 443,
  probeCount: 5,
  intervalMinutes: 15,
  backgroundEnabled: false,
  continuousSeconds: 30,
  alertRttMs: 250,
  alertLossPct: 20,
};

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

export async function loadActiveSessionId(): Promise<string | null> {
  return AsyncStorage.getItem(ACTIVE_SESSION_KEY);
}

export async function saveActiveSessionId(id: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_SESSION_KEY, id);
}
