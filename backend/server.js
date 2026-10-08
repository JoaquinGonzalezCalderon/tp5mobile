const express = require('express');
const cors = require('cors');

const app = express();
const port = Number(process.env.PORT || 3333);
app.use(cors());
app.use(express.raw({type: '*/*', limit: '20mb'}));

app.get('/health', (_req, res) => res.json({ok: true, service: 'network-qos-monitor', timestamp: new Date().toISOString()}));
app.head('/', (_req, res) => res.status(204).end());
app.get('/', (_req, res) => res.json({service: 'Network QoS Monitor reference backend', endpoints: ['/health', '/download/:bytes', '/upload']}));

app.get('/download/:bytes', (req, res) => {
  const bytes = Math.min(Math.max(Number.parseInt(req.params.bytes, 10) || 0, 1), 10 * 1024 * 1024);
  res.set({'Content-Type': 'application/octet-stream', 'Content-Length': String(bytes), 'Cache-Control': 'no-store', 'X-Payload-Bytes': String(bytes)});
  const chunk = Buffer.allocUnsafe(Math.min(bytes, 64 * 1024));
  let sent = 0;
  while (sent < bytes) {
    const size = Math.min(chunk.length, bytes - sent);
    res.write(chunk.subarray(0, size));
    sent += size;
  }
  res.end();
});

app.post('/upload', (req, res) => {
  const received = Buffer.isBuffer(req.body) ? req.body.length : 0;
  res.set({'Cache-Control': 'no-store', 'X-Bytes-Received': String(received)}).json({ok: true, bytesReceived: received});
});

app.use((_req, res) => res.status(404).json({error: 'not_found'}));
app.listen(port, '0.0.0.0', () => console.log(`Network QoS backend listening on http://0.0.0.0:${port}`));
