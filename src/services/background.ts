import notifee, {AndroidImportance} from '@notifee/react-native';
import BackgroundFetch from 'react-native-background-fetch';
import {Platform} from 'react-native';
import {Settings} from '../types';
import {runMeasurement} from './measurement';
import {loadSettings, saveMeasurement} from './storage';

let configured = false;

export async function configureBackgroundMonitor(settings: Settings): Promise<void> {
  if (!settings.backgroundEnabled) {
    if (configured) await BackgroundFetch.stop();
    configured = false;
    return;
  }
  const task = async (taskId: string) => {
    try {
      const currentSettings = await loadSettings();
      const measurement = await runMeasurement(currentSettings);
      await saveMeasurement(measurement);
      if (measurement.quality === 'poor') await notifyDegradation(measurement.probes[0]?.avg ?? 0);
    } finally {
      BackgroundFetch.finish(taskId);
    }
  };
  await BackgroundFetch.configure({
    minimumFetchInterval: Math.max(15, settings.intervalMinutes),
    stopOnTerminate: false,
    startOnBoot: true,
    enableHeadless: Platform.OS === 'android',
    requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
  }, task, task);
  configured = true;
}

async function notifyDegradation(rtt: number): Promise<void> {
  const channelId = await notifee.createChannel({id: 'qos-alerts', name: 'Alertas QoS', importance: AndroidImportance.HIGH});
  await notifee.displayNotification({title: 'Calidad de red degradada', body: `RTT promedio: ${Math.round(rtt)} ms`, android: {channelId, pressAction: {id: 'default'}}});
}

BackgroundFetch.registerHeadlessTask(async ({taskId}: {taskId: string}) => {
  try {
    const settings = await loadSettings();
    if (settings.backgroundEnabled) await saveMeasurement(await runMeasurement(settings));
  } finally {
    BackgroundFetch.finish(taskId);
  }
});
