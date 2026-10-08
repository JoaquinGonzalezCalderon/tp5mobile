const express = require('express');
const cors = require('cors');

const MAX_DOWNLOAD = 50 * 1024 * 1024;
const MAX_UPLOAD = '50mb';

const app = express();
app.disable('x-powered-by');
app.use(cors({exposedHeaders: ['X-Bytes-Received', 'X-Payload-Bytes', 'X-Server-Time']}));
app.use(express.raw({type: '*/*', limit: MAX_UPLOAD}));

// Payload pseudoaleatorio generado una vez: incompresible y sin costo de CPU por petición.
const randomBlock = Buffer.alloc(256 * 1024);
for (let i = 0; i < randomBlock.length; i += 1) randomBlock[i] = Math.floor(Math.random() * 256);

app.get('/health', (_req, res) => {
  res.set('Cache-Control', 'no-store').json({ok: true, service: 'network-qos-monitor', timestamp: new Date().toISOString()});
});

app.head('/', (_req, res) => res.status(204).end());

app.get('/', (_req, res) => res.json({
  service: 'Network QoS Monitor reference backend',
  endpoints: {
    'GET /health': 'disponibilidad y latencia base',
    'GET /download/:bytes': `payload binario de tamaño fijo (máx. ${MAX_DOWNLOAD} bytes)`,
    'POST /upload': 'echo de tamaño: devuelve los bytes recibidos',
  },
}));

app.get('/download/:bytes', (req, res) => {
  const bytes = Math.min(Math.max(Number.parseInt(req.params.bytes, 10) || 0, 1), MAX_DOWNLOAD);
  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Length': String(bytes),
    'Cache-Control': 'no-store',
    'X-Payload-Bytes': String(bytes),
  });
  let sent = 0;
  const writeMore = () => {
    while (sent < bytes) {
      const size = Math.min(randomBlock.length, bytes - sent);
      sent += size;
      if (!res.write(randomBlock.subarray(0, size))) {
        res.once('drain', writeMore);
        return;
      }
    }
    res.end();
  };
  writeMore();
});

app.post('/upload', (req, res) => {
  const received = Buffer.isBuffer(req.body) ? req.body.length : 0;
  res.set({'Cache-Control': 'no-store', 'X-Bytes-Received': String(received), 'X-Server-Time': String(Date.now())}).json({ok: true, bytesReceived: received});
});

app.use((_req, res) => res.status(404).json({error: 'not_found'}));

if (require.main === module) {
  const port = Number(process.env.PORT || 3333);
  app.listen(port, '0.0.0.0', () => console.log(`Network QoS backend listening on http://0.0.0.0:${port}`));
}

module.exports = app;
