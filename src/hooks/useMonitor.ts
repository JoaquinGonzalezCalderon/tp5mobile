import {useCallback, useEffect, useState} from 'react';
import {Measurement, Settings} from '../types';
import {loadMeasurements, loadSettings, saveMeasurement} from '../services/storage';
import {runMeasurement} from '../services/measurement';
import {configureBackgroundMonitor} from '../services/background';

export function useMonitor() {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadMeasurements(), loadSettings()]).then(([stored, config]) => {
      setMeasurements(stored);
      setSettings(config);
      configureBackgroundMonitor(config).catch(() => undefined);
    });
  }, []);

  const measure = useCallback(async () => {
    if (!settings || isMeasuring) return;
    setIsMeasuring(true);
    setError(null);
    try {
      const item = await runMeasurement(settings);
      setMeasurements(await saveMeasurement(item));
    } catch (measurementError) {
      setError(measurementError instanceof Error ? measurementError.message : 'No se pudo completar la medición');
    } finally {
      setIsMeasuring(false);
    }
  }, [isMeasuring, settings]);

  const updateSettings = useCallback((next: Settings) => {
    setSettings(next);
    configureBackgroundMonitor(next).catch(() => undefined);
  }, []);
  return {measurements, settings, isMeasuring, error, measure, updateSettings};
}
