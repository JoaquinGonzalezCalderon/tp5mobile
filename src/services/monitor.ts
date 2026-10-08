import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {AndroidImportance} from '@notifee/react-native';
import {Measurement, Settings} from '../types';
import {createSession, initDatabase, insertMeasurement, listSessions} from './database';
import {runMeasurement} from './measurement';
import {aggregateProbes} from './stats';
import {loadActiveSessionId, saveActiveSessionId} from './storage';

const LAST_ALERT_KEY = '@network-qos/last-alert';
const ALERT_COOLDOWN_MS = 10 * 60 * 1000;

/** Devuelve la sesión activa, creando la primera si no existe. Lo usan la UI y la tarea en segundo plano. */
export async function ensureActiveSession(): Promise<string> {
  await initDatabase();
  const stored = await loadActiveSessionId();
  const sessions = await listSessions();
  if (stored && sessions.some(item => item.id === stored)) return stored;
  // Las mediciones migradas de la versión anterior quedan en su propia sesión, no se mezclan con las nuevas.
  const session = sessions.find(item => item.name !== 'Importadas') ?? (await createSession());
  await saveActiveSessionId(session.id);
  return session.id;
}

/** Medición completa → persistencia → alerta si hay degradación severa. */
export async function measureAndStore(settings: Settings, trigger: Measurement['trigger'], sessionId?: string): Promise<Measurement> {
  const activeSession = sessionId ?? (await ensureActiveSession());
  const measurement = await runMeasurement(settings, activeSession, trigger);
  await insertMeasurement(measurement);
  const reason = degradationReason(measurement, settings);
  if (reason) await notifyDegradation(reason);
  return measurement;
}

export function degradationReason(measurement: Measurement, settings: Settings): string | null {
  const {avg, loss} = aggregateProbes(measurement.probes);
  if (measurement.network.type === 'none') return 'Sin conectividad de datos';
  if (loss >= settings.alertLossPct) return `Pérdida de paquetes del ${Math.round(loss)} %`;
  if (avg >= settings.alertRttMs) return `Latencia promedio de ${Math.round(avg)} ms`;
  if (measurement.quality === 'poor') return 'Calidad de red pobre';
  return null;
}

async function notifyDegradation(reason: string): Promise<void> {
  const last = Number((await AsyncStorage.getItem(LAST_ALERT_KEY)) ?? 0);
  if (Date.now() - last < ALERT_COOLDOWN_MS) return;
  await AsyncStorage.setItem(LAST_ALERT_KEY, String(Date.now()));
  const channelId = await notifee.createChannel({id: 'qos-alerts', name: 'Alertas de calidad de red', importance: AndroidImportance.HIGH});
  await notifee.displayNotification({
    title: 'Calidad de red degradada',
    body: reason,
    android: {channelId, smallIcon: 'ic_stat_qos', color: '#D94A5B', pressAction: {id: 'default'}},
  });
}
