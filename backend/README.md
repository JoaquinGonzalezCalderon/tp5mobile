# Backend de referencia

```bash
npm install
npm run dev
```

Endpoints:

- `GET /health`: disponibilidad y RTT.
- `GET /download/:bytes`: payload binario sin cache, limitado a 10 MB.
- `POST /upload`: recibe un payload y devuelve la cantidad de bytes recibidos.

Para probarlo: `curl http://localhost:3333/health`.
