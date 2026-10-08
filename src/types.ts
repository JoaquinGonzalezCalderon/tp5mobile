export type NetworkType = 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown';

export type QoSStatus = 'excellent' | 'good' | 'fair' | 'poor';

export type ProbeResult = {
  host: string;
  min: number;
  avg: number;
  max: number;
  jitter: number;
  loss: number;
  samples: number[];
};

export type ThroughputResult = {
  /** Mbps corregidos por la latencia base del backend. */
  download: number;
  upload: number;
  downloadBytes: number;
  uploadBytes: number;
  /** Latencia base (petición mínima) descontada del tiempo de transferencia. */
  baseLatencyMs: number;
  durationMs: number;
};

export type Location = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

export type NetworkInfo = {
  type: NetworkType;
  carrier?: string;
  generation?: string;
  /** dBm de la celda servidora o del AP Wi-Fi. */
  rssi?: number;
  /** Nivel 0-4 informado por el sistema. */
  level?: number;
  ipAddress?: string;
  source: 'native' | 'netinfo';
};

export type Measurement = {
  id: string;
  sessionId: string;
  timestamp: string;
  network: NetworkInfo;
  location: Location | null;
  probes: ProbeResult[];
  throughput: ThroughputResult;
  quality: QoSStatus;
  backend: string;
  trigger: 'manual' | 'continuous' | 'background';
};

export type Session = {
  id: string;
  name: string;
  startedAt: string;
  count: number;
};

export type Settings = {
  backendUrl: string;
  hosts: string[];
  probePort: number;
  probeCount: number;
  intervalMinutes: number;
  backgroundEnabled: boolean;
  continuousSeconds: number;
  alertRttMs: number;
  alertLossPct: number;
};

export type DatePreset = 'all' | 'today' | '7d' | '30d';

export type HistoryFilter = {
  networkTypes: NetworkType[];
  datePreset: DatePreset;
  /** Radio en metros alrededor de la posición actual; null = sin filtro geográfico. */
  radiusMeters: number | null;
  center: Location | null;
  sessionId: string | null;
};
