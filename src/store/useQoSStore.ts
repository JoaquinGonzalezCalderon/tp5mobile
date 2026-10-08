import {create} from 'zustand';
import {HistoryFilter, Measurement, Session, Settings} from '../types';
import {clearAll, createSession, listSessions, queryMeasurements, renameSession} from '../services/database';
import {configureBackgroundMonitor} from '../services/background';
import {ensureActiveSession, measureAndStore} from '../services/monitor';
import {getCurrentLocation, requestPermissions} from '../services/native';
import {loadSettings, saveActiveSessionId, saveSettings} from '../services/storage';

type QoSState = {
  ready: boolean;
  settings: Settings | null;
  measurements: Measurement[];
  sessions: Session[];
  activeSessionId: string | null;
  isMeasuring: boolean;
  continuous: boolean;
  error: string | null;
  filter: HistoryFilter;
  filtered: Measurement[];

  init: () => Promise<void>;
  measure: (trigger?: Measurement['trigger']) => Promise<void>;
  setContinuous: (enabled: boolean) => void;
  startSession: () => Promise<void>;
  selectSession: (id: string) => Promise<void>;
  renameSession: (id: string, name: string) => Promise<void>;
  updateSettings: (settings: Settings) => Promise<void>;
  setFilter: (patch: Partial<HistoryFilter>) => Promise<void>;
  refresh: () => Promise<void>;
  clearHistory: () => Promise<void>;
};

let continuousTimer: ReturnType<typeof setInterval> | null = null;

export const defaultFilter: HistoryFilter = {networkTypes: [], datePreset: 'all', radiusMeters: null, center: null, sessionId: null};

/**
 * Store reactivo: las mediciones corren en el módulo nativo y en promesas; la UI solo se suscribe
 * a este estado, así el hilo JS nunca queda bloqueado esperando una sonda.
 */
export const useQoSStore = create<QoSState>((set, get) => ({
  ready: false,
  settings: null,
  measurements: [],
  sessions: [],
  activeSessionId: null,
  isMeasuring: false,
  continuous: false,
  error: null,
  filter: defaultFilter,
  filtered: [],

  init: async () => {
    const settings = await loadSettings();
    const activeSessionId = await ensureActiveSession();
    set({settings, activeSessionId});
    await get().refresh();
    set({ready: true});
    await requestPermissions().catch(() => undefined);
    configureBackgroundMonitor(settings).catch(() => undefined);
  },

  measure: async (trigger = 'manual') => {
    const {settings, isMeasuring, activeSessionId} = get();
    if (!settings || isMeasuring) return;
    set({isMeasuring: true, error: null});
    try {
      await measureAndStore(settings, trigger, activeSessionId ?? undefined);
      await get().refresh();
    } catch (error) {
      set({error: error instanceof Error ? error.message : 'No se pudo completar la medición'});
    } finally {
      set({isMeasuring: false});
    }
  },

  setContinuous: enabled => {
    if (continuousTimer) clearInterval(continuousTimer);
    continuousTimer = null;
    set({continuous: enabled});
    if (!enabled) return;
    const seconds = Math.max(10, get().settings?.continuousSeconds ?? 30);
    get().measure('continuous');
    continuousTimer = setInterval(() => get().measure('continuous'), seconds * 1000);
  },

  startSession: async () => {
    const session = await createSession();
    await saveActiveSessionId(session.id);
    set({activeSessionId: session.id});
    await get().refresh();
  },

  selectSession: async id => {
    await saveActiveSessionId(id);
    set({activeSessionId: id});
  },

  renameSession: async (id, name) => {
    await renameSession(id, name);
    await get().refresh();
  },

  updateSettings: async settings => {
    await saveSettings(settings);
    set({settings});
    await configureBackgroundMonitor(settings);
  },

  setFilter: async patch => {
    let next = {...get().filter, ...patch};
    // El chip se marca al instante; la consulta espera la ubicación solo si hace falta.
    set({filter: next});
    if (patch.radiusMeters && !next.center) {
      next = {...next, center: await getCurrentLocation()};
      set({filter: next});
    }
    set({filtered: await queryMeasurements(next)});
  },

  refresh: async () => {
    const [measurements, sessions, filtered] = await Promise.all([queryMeasurements(), listSessions(), queryMeasurements(get().filter)]);
    set({measurements, sessions, filtered});
  },

  clearHistory: async () => {
    await clearAll();
    const activeSessionId = await ensureActiveSession();
    set({activeSessionId});
    await get().refresh();
  },
}));
