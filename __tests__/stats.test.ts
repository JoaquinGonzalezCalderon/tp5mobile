import {
  aggregateProbes,
  boundingBox,
  classifyQuality,
  correctedMbps,
  dateFrom,
  haversineMeters,
  summarizeProbe,
  toCsv,
} from '../src/services/stats';
import {Measurement, ProbeResult} from '../src/types';

const probe = (avg: number, loss = 0, jitter = 2): ProbeResult => ({host: 'h', min: avg, avg, max: avg, jitter, loss, samples: [avg]});

describe('summarizeProbe', () => {
  it('calcula min/avg/max, jitter entre muestras consecutivas y pérdida', () => {
    const result = summarizeProbe('1.1.1.1', [10, 20, 15, 25], 5);
    expect(result).toMatchObject({min: 10, max: 25, avg: 17.5, loss: 20});
    // |20-10| + |15-20| + |25-15| = 25 → 25 / 3
    expect(result.jitter).toBeCloseTo(8.33, 2);
  });

  it('sin respuestas devuelve 100 % de pérdida', () => {
    expect(summarizeProbe('x', [], 4)).toMatchObject({loss: 100, avg: 0, samples: []});
  });
});

describe('correctedMbps', () => {
  it('descuenta la latencia base del tiempo de transferencia', () => {
    // 1 MB en 1000 ms con 200 ms de latencia base → 8.39 Mbit / 0.8 s
    expect(correctedMbps(1_048_576, 1000, 200)).toBeCloseTo(10.49, 2);
  });

  it('nunca descuenta más del 80 % del tiempo medido', () => {
    expect(correctedMbps(1_000_000, 100, 500)).toBe(correctedMbps(1_000_000, 20, 0));
  });

  it('devuelve 0 ante datos inválidos', () => {
    expect(correctedMbps(0, 100, 0)).toBe(0);
    expect(correctedMbps(100, 0, 0)).toBe(0);
  });
});

describe('classifyQuality', () => {
  it('clasifica según latencia, pérdida y throughput', () => {
    expect(classifyQuality([probe(20)], {download: 50})).toBe('excellent');
    expect(classifyQuality([probe(80)], {download: 50})).toBe('good');
    expect(classifyQuality([probe(150)], {download: 50})).toBe('fair');
    expect(classifyQuality([probe(20)], {download: 1})).toBe('fair');
    expect(classifyQuality([probe(300)], {download: 50})).toBe('poor');
    expect(classifyQuality([probe(20, 30)], {download: 50})).toBe('poor');
    expect(classifyQuality([], {download: 50})).toBe('poor');
  });

  it('ignora hosts caídos para el promedio pero los cuenta en la pérdida', () => {
    const agg = aggregateProbes([probe(20), {...probe(0), loss: 100}]);
    expect(agg).toEqual({avg: 20, jitter: 2, loss: 50});
  });
});

describe('geografía', () => {
  const obelisco = {latitude: -34.6037, longitude: -58.3816};
  const congreso = {latitude: -34.6098, longitude: -58.3925};

  it('haversine da la distancia en metros', () => {
    expect(haversineMeters(obelisco, congreso)).toBeGreaterThan(1100);
    expect(haversineMeters(obelisco, congreso)).toBeLessThan(1300);
  });

  it('la bounding box contiene puntos dentro del radio', () => {
    const box = boundingBox(obelisco, 2000);
    expect(congreso.latitude).toBeGreaterThan(box.minLat);
    expect(congreso.latitude).toBeLessThan(box.maxLat);
    expect(congreso.longitude).toBeGreaterThan(box.minLng);
    expect(congreso.longitude).toBeLessThan(box.maxLng);
  });
});

describe('dateFrom', () => {
  const now = new Date(2026, 9, 7, 15, 30);
  it('resuelve los presets de fecha', () => {
    expect(dateFrom('all', now)).toBeNull();
    expect(dateFrom('today', now)).toBe(new Date(2026, 9, 7).getTime());
    expect(dateFrom('7d', now)).toBe(now.getTime() - 7 * 86_400_000);
  });
});

describe('toCsv', () => {
  it('genera encabezado y escapa comillas', () => {
    const measurement: Measurement = {
      id: 'm1', sessionId: 's1', timestamp: '2026-10-07T12:00:00.000Z', trigger: 'manual', backend: 'http://x', quality: 'good',
      network: {type: 'cellular', generation: '4G LTE', carrier: 'Movi "Star"', rssi: -90, source: 'native'},
      location: {latitude: -32.48, longitude: -58.23, accuracy: 5},
      probes: [probe(40)],
      throughput: {download: 12.5, upload: 4.2, downloadBytes: 1, uploadBytes: 1, baseLatencyMs: 30, durationMs: 900},
    };
    const [header, row] = toCsv([measurement]).split('\n');
    expect(header?.startsWith('id,session_id,timestamp')).toBe(true);
    expect(row).toContain('"Movi ""Star"""');
    expect(row).toContain('"12.5"');
  });
});
