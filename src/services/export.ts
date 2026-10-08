import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import {Platform} from 'react-native';
import {Measurement} from '../types';
import {toCsv} from './stats';

/** Escribe el historial en un archivo y abre la hoja de compartir del sistema (Drive, mail, Archivos, etc.). */
export async function exportMeasurements(measurements: Measurement[], format: 'csv' | 'json'): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `network-qos-${stamp}.${format}`;
  const dir = Platform.OS === 'android' ? RNFS.ExternalDirectoryPath : RNFS.DocumentDirectoryPath;
  const path = `${dir}/${fileName}`;
  const content = format === 'csv' ? toCsv(measurements) : JSON.stringify(measurements, null, 2);
  await RNFS.writeFile(path, content, 'utf8');
  try {
    await Share.open({
      url: `file://${path}`,
      type: format === 'csv' ? 'text/csv' : 'application/json',
      filename: fileName,
      title: 'Exportar historial QoS',
      failOnCancel: false,
    });
  } catch {
    // Cancelar la hoja de compartir no es un error: el archivo ya quedó guardado.
  }
  return path;
}
