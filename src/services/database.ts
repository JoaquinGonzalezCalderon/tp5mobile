import {open, QuickSQLiteConnection} from 'react-native-quick-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {HistoryFilter, Measurement, Session} from '../types';
import {aggregateProbes, boundingBox, dateFrom, haversineMeters} from './stats';

let connection: QuickSQLiteConnection | null = null;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    started_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS measurements (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    ts INTEGER NOT NULL,
    network_type TEXT NOT NULL,
    generation TEXT,
    carrier TEXT,
    rssi INTEGER,
    lat REAL,
    lng REAL,
    rtt_avg REAL,
    jitter REAL,
    loss REAL,
    download REAL,
    upload REAL,
    quality TEXT NOT NULL,
    payload TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_measurements_ts ON measurements(ts)',
  'CREATE INDEX IF NOT EXISTS idx_measurements_geo ON measurements(lat, lng)',
  'CREATE INDEX IF NOT EXISTS idx_measurements_session ON measurements(session_id, ts)',
];

function db(): QuickSQLiteConnection {
  if (!connection) {
    connection = open({name: 'network_qos.sqlite'});
    for (const statement of SCHEMA) connection.execute(statement);
  }
  return connection;
}

function rows<T>(result: {rows?: {_array: unknown[]}}): T[] {
  return (result.rows?._array ?? []) as T[];
}

export async function initDatabase(): Promise<void> {
  db();
  await migrateFromAsyncStorage();
}

export async function createSession(name?: string): Promise<Session> {
  const startedAt = new Date();
  const count = rows<{n: number}>(await db().executeAsync('SELECT COUNT(*) AS n FROM sessions'))[0]?.n ?? 0;
  const session: Session = {
    id: `s-${startedAt.getTime()}`,
    name: name ?? `Sesión ${count + 1}`,
    startedAt: startedAt.toISOString(),
    count: 0,
  };
  await db().executeAsync('INSERT INTO sessions (id, name, started_at) VALUES (?, ?, ?)', [session.id, session.name, startedAt.getTime()]);
  return session;
}

export async function listSessions(): Promise<Session[]> {
  const result = await db().executeAsync(
    `SELECT s.id, s.name, s.started_at, COUNT(m.id) AS count
     FROM sessions s LEFT JOIN measurements m ON m.session_id = s.id
     GROUP BY s.id ORDER BY s.started_at DESC`,
  );
  return rows<{id: string; name: string; started_at: number; count: number}>(result).map(row => ({
    id: row.id,
    name: row.name,
    startedAt: new Date(row.started_at).toISOString(),
    count: row.count,
  }));
}

export async function renameSession(id: string, name: string): Promise<void> {
  await db().executeAsync('UPDATE sessions SET name = ? WHERE id = ?', [name, id]);
}

export async function insertMeasurement(item: Measurement): Promise<void> {
  const agg = aggregateProbes(item.probes);
  await db().executeAsync(
    `INSERT OR REPLACE INTO measurements
      (id, session_id, ts, network_type, generation, carrier, rssi, lat, lng, rtt_avg, jitter, loss, download, upload, quality, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id, item.sessionId, new Date(item.timestamp).getTime(), item.network.type, item.network.generation ?? null, item.network.carrier ?? null,
      item.network.rssi ?? null, item.location?.latitude ?? null, item.location?.longitude ?? null, agg.avg, agg.jitter, agg.loss,
      item.throughput.download, item.throughput.upload, item.quality, JSON.stringify(item),
    ],
  );
}

/** Consulta filtrada: tipo de red, fecha y sesión se resuelven en SQL; la zona con bounding box en SQL + haversine exacto. */
export async function queryMeasurements(filter: Partial<HistoryFilter> = {}, limit = 2000): Promise<Measurement[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.networkTypes?.length) {
    where.push(`network_type IN (${filter.networkTypes.map(() => '?').join(', ')})`);
    params.push(...filter.networkTypes);
  }
  const from = dateFrom(filter.datePreset ?? 'all');
  if (from !== null) {
    where.push('ts >= ?');
    params.push(from);
  }
  if (filter.sessionId) {
    where.push('session_id = ?');
    params.push(filter.sessionId);
  }
  const useZone = Boolean(filter.radiusMeters && filter.center);
  if (useZone && filter.center && filter.radiusMeters) {
    const box = boundingBox(filter.center, filter.radiusMeters);
    where.push('lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?');
    params.push(box.minLat, box.maxLat, box.minLng, box.maxLng);
  }
  const sql = `SELECT payload FROM measurements ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ts DESC LIMIT ${limit}`;
  const items = rows<{payload: string}>(await db().executeAsync(sql, params)).map(row => JSON.parse(row.payload) as Measurement);
  if (!useZone || !filter.center || !filter.radiusMeters) return items;
  const center = filter.center;
  const radius = filter.radiusMeters;
  return items.filter(item => item.location && haversineMeters(center, item.location) <= radius);
}

export async function clearAll(): Promise<void> {
  await db().executeAsync('DELETE FROM measurements');
  await db().executeAsync('DELETE FROM sessions');
}

/** La versión anterior guardaba en AsyncStorage: se importa una sola vez a SQLite. */
async function migrateFromAsyncStorage(): Promise<void> {
  const key = '@network-qos/measurements';
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return;
  try {
    const legacy = JSON.parse(raw) as Array<Partial<Measurement> & {id: string; timestamp: string}>;
    if (legacy.length) {
      const session = await createSession('Importadas');
      for (const item of legacy) {
        await insertMeasurement({
          trigger: 'manual',
          backend: '',
          probes: [],
          location: null,
          quality: 'fair',
          ...item,
          sessionId: session.id,
          network: {type: 'unknown', source: 'netinfo', ...item.network},
          throughput: {download: 0, upload: 0, downloadBytes: 0, uploadBytes: 0, baseLatencyMs: 0, durationMs: 0, ...item.throughput},
        } as Measurement);
      }
    }
  } finally {
    await AsyncStorage.removeItem(key);
  }
}
