# Network QoS Monitor

TP5 – Desarrollo de Aplicaciones Móviles · Licenciatura en Sistemas de Información · FCyT Sede Concepción del Uruguay · 2026.

Aplicación móvil React Native CLI que **mide, almacena y visualiza la calidad de la red de datos** del dispositivo (QoS/QoE) y la correlaciona con la ubicación, generando un historial navegable y un **mapa de cobertura personal** construido con mediciones propias.

| | |
|---|---|
| Plataforma | Android (probado) · iOS (código incluido, ver limitaciones) |
| Stack | React Native 0.76 (CLI, Hermes) · TypeScript · Kotlin |
| Backend | Node.js 22 + Express, con Dockerfile |
| APK de prueba | `android/app/build/outputs/apk/release/app-release.apk` (ver [Build](#build-del-apk)) |

---

## Requisitos funcionales cubiertos

| ID | Requisito | Implementación |
|---|---|---|
| RF-01 | Tipo de red y operador | Módulo nativo Kotlin (`TelephonyManager` + `ConnectivityManager`): Wi-Fi / celular / ethernet, generación 2G · 3G · 4G LTE · 5G NR, operador, RSSI en dBm y nivel 0-4. NetInfo como respaldo. |
| RF-02 | RTT contra ≥ 3 hosts configurables con min/avg/max/jitter | Sondas propias sobre **sockets TCP** (tiempo del handshake `connect`) en un pool de hilos nativo. Hosts, puerto y cantidad de sondas configurables. Jitter según RFC 3550 (variación media entre muestras consecutivas). Pérdida = sondas sin respuesta. |
| RF-03 | Throughput de descarga y subida en Mbps | Contra el backend propio: 2 MB de bajada y 1 MB de subida, **corregido por la latencia base** (mediana de 3 peticiones mínimas) para no subestimar por handshake/TTFB. |
| RF-04 | Timestamp y GPS en cada medición | Cada medición guarda ISO timestamp, lat/lng y precisión. |
| RF-05 | Mapa con heatmap de señal/calidad | Leaflet + `leaflet.heat` sobre OpenStreetMap. Tres capas: **calidad QoS**, **señal (RSSI)** y **latencia**. Filtro por sesión, marcadores con detalle. |
| RF-06 | Series temporales por sesión | Gráficos SVG de RTT + jitter, descarga + subida y pérdida, por sesión de medición. |
| RF-07 | Mediciones en background y alertas | `react-native-background-fetch` (JobScheduler + **Headless JS**, sigue con la app cerrada y tras reiniciar). Notificación local (Notifee) ante degradación severa, con umbrales configurables y *cooldown* de 10 min. |
| RF-08 | Exportar CSV/JSON | Genera el archivo y abre la hoja de compartir del sistema (Drive, Gmail, etc.). Exporta todo o solo lo filtrado. |
| RF-09 | Filtrar por tipo de red, fechas y zona | Filtros por tipo de red, rango (hoy / 7 / 30 días / todo) y radio alrededor de la posición actual (500 m / 2 km / 10 km), resueltos con consultas SQLite. |

Además: **sesiones de medición** (agrupan recorridos), **monitoreo continuo** en primer plano cada N segundos, y migración automática de datos de la versión anterior.

---

## Arquitectura

Arquitectura en capas según la consigna, con un store reactivo como único punto de contacto de la UI:

```
┌──────────────────────────── Presentation ─────────────────────────────┐
│  HomeScreen · MapScreen · ChartsScreen · HistoryScreen · Settings     │
│  CoverageMap (WebView + Leaflet/heat) · LineChart (react-native-svg)  │
└──────────────────────────────┬────────────────────────────────────────┘
                               │  suscripción
                    ┌──────────▼──────────┐
                    │  useQoSStore        │  Zustand (estado + acciones)
                    └──────────┬──────────┘
       ┌───────────────────────┼─────────────────────────┐
┌──────▼───────┐    ┌──────────▼──────────┐    ┌─────────▼────────┐
│ Measurement  │    │ Persistence         │    │ Sync / Export    │
│ Engine       │    │ database.ts         │    │ export.ts        │
│ measurement  │    │ SQLite (quick-sqlite)│   │ RNFS + Share     │
│ monitor      │    │ queries fecha/zona  │    └──────────────────┘
│ background   │    └─────────────────────┘
└──────┬───────┘
       │
┌──────▼──────────────────────────────┐   ┌───────────────────────────┐
│ Native Bridge  (native.ts)          │   │ Backend de referencia     │
│ NetworkQoSModule.kt / .swift        │   │ Express: /health          │
│ TelephonyManager · sockets TCP      │   │ /download/:bytes /upload  │
│ NetInfo · Geolocation (Geo Layer)   │   └───────────────────────────┘
└─────────────────────────────────────┘
```

| Capa | Archivos | Responsabilidad |
|---|---|---|
| Native Bridge | `android/.../NetworkQoSModule.kt`, `ios/NetworkQoS/*`, `src/services/native.ts` | RSSI, generación celular, operador, sondas TCP, permisos |
| Measurement Engine | `src/services/measurement.ts`, `monitor.ts`, `background.ts` | Orquesta red + GPS + sondas en paralelo y luego throughput; clasifica calidad; alerta; muestreo periódico |
| Persistence | `src/services/database.ts` | Esquema SQLite con índices por fecha, geo y sesión; consultas filtradas |
| Geo Layer | `native.ts` (`getCurrentLocation`), `stats.ts` (`haversineMeters`, `boundingBox`) | Ubicación de alta precisión (máx. 5 s de antigüedad), filtro por radio |
| Presentation | `src/screens/*`, `src/components/*` | Mapa, gráficos, historial, ajustes |
| Lógica pura | `src/services/stats.ts` | Estadísticas, corrección de throughput, clasificación, CSV (cubierta por tests) |

### Modelo de datos (SQLite)

```sql
sessions(id TEXT PK, name TEXT, started_at INTEGER)
measurements(id TEXT PK, session_id TEXT, ts INTEGER, network_type TEXT, generation TEXT,
             carrier TEXT, rssi INTEGER, lat REAL, lng REAL, rtt_avg REAL, jitter REAL,
             loss REAL, download REAL, upload REAL, quality TEXT, payload TEXT /* JSON completo */)
INDEX(ts) · INDEX(lat, lng) · INDEX(session_id, ts)
```

Las columnas desnormalizadas permiten filtrar y ordenar en SQL; `payload` conserva la medición completa (sondas por host, muestras) para exportar sin pérdida.

### Clasificación de calidad

Se usa el promedio de los hosts que respondieron (la pérdida promedia todos):

| Calidad | Condición |
|---|---|
| Pobre | pérdida ≥ 20 %, RTT > 250 ms o sin respuesta |
| Regular | pérdida > 5 %, RTT > 120 ms, jitter > 40 ms o descarga < 2 Mbps |
| Buena | RTT > 60 ms, jitter > 15 ms o descarga < 10 Mbps |
| Excelente | el resto |

---

## Decisiones de diseño

- **Sondas TCP en el módulo nativo en vez de `react-native-tcp-socket`.** El RTT se mide en Kotlin con `System.nanoTime()` alrededor de `Socket.connect()`, resolviendo DNS *antes* de medir, en un pool de hilos propio: el hilo JS nunca espera y la medición no incluye overhead del bridge. Los hosts se sondean en paralelo y las muestras de un host en serie (para que el jitter tenga sentido). Puerto por defecto 443, que responden los tres hosts por defecto (8.8.8.8 no escucha en el 80).
- **Leaflet en WebView en vez de `react-native-maps`.** En Android `react-native-maps` usa Google Maps, que exige una API key con facturación. Leaflet + OpenStreetMap no requiere claves y `leaflet.heat` da el mismo modelo de datos (lat, lng, intensidad) que el Heatmap overlay de react-native-maps.
- **Heatmap que no confunde densidad con calidad.** Un heatmap clásico suma intensidades: diez mediciones malas en el mismo lugar se verían "más fuertes". Se promedia el puntaje por celda de ~30 m y se dibuja una capa por nivel de calidad, cada una de un color, con atenuación por zoom desactivada.
- **SQLite (`react-native-quick-sqlite`, JSI) en vez de AsyncStorage.** Permite consultas por fecha/zona/sesión con índices. `react-native-sqlite-storage` se descartó porque no compila con Gradle 8.
- **Zustand** como store reactivo: las mediciones son promesas y la UI solo se suscribe al estado.
- **Throughput corregido**: `Mbps = bytes·8 / (t_total − latencia_base)`, con la latencia base acotada al 80 % del tiempo medido. El backend envía un bloque pseudoaleatorio (incompresible) respetando *backpressure*.
- **Gráficos con `react-native-svg` propios** en lugar de victory-native (que en sus versiones actuales arrastra Skia + Reanimated): menos dependencias nativas y control total del estilo.

---

## Puesta en marcha

Requisitos: Node 18+, JDK 17+ (sirve el que trae Android Studio en `Android Studio/jbr`), Android SDK, un emulador o un celular con depuración USB.

```bash
npm install
npm --prefix backend install

# Terminal 1: backend de referencia
npm run backend            # http://0.0.0.0:3333

# Terminal 2: Metro
npm start

# Terminal 3: compilar e instalar
npm run android
```

- **Emulador Android**: la URL por defecto `http://10.0.2.2:3333` ya apunta a la PC.
- **Celular físico**: en *Ajustes → URL base* poner `http://IP-de-la-PC:3333` (misma red Wi-Fi y puerto 3333 habilitado en el firewall) o la URL del backend desplegado.
- **Windows**: si Gradle falla con `Could not move temporary workspace`, usar una caché fuera del proyecto: `cd android && gradlew installDebug --project-cache-dir C:/gradle-pc/tp5`.

### Tests

```bash
npm test                   # Jest: estadísticas, clasificación, geografía, CSV
npm --prefix backend test  # node:test: /health, /download, /upload
npm run typecheck
```

### Build del APK

```bash
cd android
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64
# → android/app/build/outputs/apk/release/app-release.apk
```

El APK de prueba está firmado con la clave de debug (suficiente para instalarlo por USB o compartirlo; para Play Store hay que generar un keystore propio).

---

## Backend de referencia

`backend/server.js` (Express):

| Endpoint | Descripción |
|---|---|
| `GET /health` | Disponibilidad; se usa para medir la latencia base |
| `GET /download/:bytes` | Payload binario incompresible de tamaño fijo (máx. 50 MB), sin caché |
| `POST /upload` | Recibe el payload y devuelve los bytes recibidos (`X-Bytes-Received`) |

### Despliegue

**Docker (local o cualquier VPS):**

```bash
docker compose up -d --build        # expone :3333
curl http://localhost:3333/health
```

**Render / Railway / Fly.io:** crear un servicio desde el repositorio con *root directory* `backend/` (detectan el `Dockerfile`), o como servicio Node con `npm ci` y `npm start`. La plataforma inyecta `PORT`. Luego cargar la URL pública en *Ajustes → URL base* de la app.

> El throughput medido es el del tramo dispositivo ↔ backend: para medir la red móvil conviene que el backend esté en un servidor con buen ancho de banda (no en la misma Wi-Fi que el celular).

---

## Limitaciones conocidas

- **iOS no fue compilado ni probado** (el desarrollo se hizo en Windows). El módulo Swift (`ios/NetworkQoS/`) existe pero hay que agregarlo al target en Xcode y correr `pod install`. Además iOS no expone RSSI celular ni la intensidad Wi-Fi a apps de terceros: en iOS esos campos quedan vacíos.
- **Segundo plano**: Android e iOS imponen un mínimo de 15 min entre ejecuciones y pueden diferirlas por batería (Doze / BGTaskScheduler). Para pruebas se puede forzar con `adb shell cmd jobscheduler run -f com.networkqosmonitor 999`.
- **Generación celular** requiere el permiso `READ_PHONE_STATE`; si se niega, se usa la información de NetInfo.
- **Ubicación en segundo plano** (Android 10+) requiere elegir "Permitir todo el tiempo"; si no, las mediciones automáticas se guardan sin coordenadas y no aparecen en el mapa.
- **Emulador**: el GPS es simulado (`adb emu geo fix`) y la red es la de la PC, así que el "Wi-Fi" y el RSSI son virtuales. Las métricas de RTT y throughput sí son reales.
- **Tiles de OpenStreetMap**: el servidor público tiene una política de uso justo; para uso intensivo conviene un proveedor propio de tiles.
- **16 KB page size**: React Native 0.76 no está alineado a páginas de 16 KB; Android 15+ muestra un aviso de compatibilidad (la app funciona igual). Se resuelve actualizando a RN ≥ 0.77.
- El APK está firmado con la clave de debug.

## Video demo

Ver el enlace incluido en la entrega (3-5 min: detección de red, latencia/throughput, mapa de calor con 2 sesiones, gráficos, filtros, exportación y alerta en segundo plano).
