import BackgroundFetch from 'react-native-background-fetch';
import {Settings} from '../types';
import {measureAndStore} from './monitor';
import {loadSettings} from './storage';

async function backgroundSample(taskId: string): Promise<void> {
  try {
    const settings = await loadSettings();
    if (settings.backgroundEnabled) await measureAndStore(settings, 'background');
  } catch {
    // Un muestreo fallido no debe impedir que el sistema programe el siguiente.
  } finally {
    BackgroundFetch.finish(taskId);
  }
}

/**
 * Android usa JobScheduler (y Headless JS con la app cerrada); iOS usa BGTaskScheduler.
 * El sistema impone un mínimo de 15 minutos entre ejecuciones.
 */
export async function configureBackgroundMonitor(settings: Settings): Promise<void> {
  if (!settings.backgroundEnabled) {
    await BackgroundFetch.stop().catch(() => undefined);
    return;
  }
  await BackgroundFetch.configure(
    {
      minimumFetchInterval: Math.max(15, settings.intervalMinutes),
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
      requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
    },
    backgroundSample,
    taskId => BackgroundFetch.finish(taskId),
  );
  await BackgroundFetch.start();
}

/** Se registra en index.js, fuera del árbol de React, para que corra con la app cerrada. */
export function registerHeadlessTask(): void {
  BackgroundFetch.registerHeadlessTask(async ({taskId, timeout}: {taskId: string; timeout: boolean}) => {
    if (timeout) {
      BackgroundFetch.finish(taskId);
      return;
    }
    await backgroundSample(taskId);
  });
}
