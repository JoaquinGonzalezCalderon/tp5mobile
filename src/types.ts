export type NetworkType = 'wifi' | 'cellular' | 'ethernet' | 'unknown';

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
  download: number;
  upload: number;
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
  rssi?: number;
  ipAddress?: string;
};

export type Measurement = {
  id: string;
  timestamp: string;
  network: NetworkInfo;
  location: Location | null;
  probes: ProbeResult[];
  throughput: ThroughputResult;
  quality: QoSStatus;
  backend: string;
};

export type Settings = {
  backendUrl: string;
  hosts: string[];
  intervalMinutes: number;
  backgroundEnabled: boolean;
};
