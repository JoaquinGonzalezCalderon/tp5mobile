# Network QoS Monitor

Implementación del TP5: aplicación móvil React Native CLI para medir QoS/QoE, almacenar mediciones locales y representarlas como historial georreferenciado.

## Qué incluye

- Detección de tipo de red, operador, generación celular y RSSI mediante NetInfo y el puente nativo `NetworkQoS`.
- Sondas contra tres hosts configurables con RTT, min/avg/max, jitter y pérdida.
- Test de throughput contra `backend/` para descarga y subida.
- Persistencia local en AsyncStorage, mapa de cobertura con puntos de calidad, tendencia de sesiones e historial filtrable.
- Exportación CSV/JSON.
- Configuración del backend y hosts desde la aplicación.
- Backend Express autocontenido con `/health`, `/download/:bytes` y `/upload`.

## Arranque

Requisitos: Node 18+, Android Studio/JDK 17 para Android, Xcode para iOS.

```bash
npm install
cd backend
npm install
cd ..
npm run backend
```

En otra terminal:

```bash
npm start
npm run android   # o npm run ios
```

La URL por defecto es `http://10.0.2.2:3333` para Android Emulator. En iOS Simulator cambiarla desde Ajustes a `http://localhost:3333`. En un celular físico usar la IP LAN de la PC y permitir el puerto 3333 en el firewall.

## Módulo nativo

El contrato de `NativeModules.NetworkQoS` está en `src/services/native.ts`. Si el módulo todavía no está vinculado, la app conserva un fallback JS con NetInfo, geolocalización y sondas HTTP para que la interfaz siga funcionando. La implementación nativa se agrega en:

- Android: `android/app/src/main/java/com/networkqos/NetworkQoSModule.kt`.
- iOS: `ios/NetworkQoS/NetworkQoSModule.swift`.

Android ya registra el paquete manualmente en `MainApplication` y declara Internet, ubicación y estado de teléfono. En iOS, seleccionar `ios/NetworkQoS/NetworkQoSModule.swift` y `NetworkQoSModule.m` en el target `NetworkQoSMonitor` desde Xcode una vez; el fallback JS permite ejecutar la app aunque el bridge no se haya agregado todavía. En producción conviene reemplazar la frecuencia de background por WorkManager/BGTaskScheduler con límites de batería del sistema.

## Decisiones y limitaciones

La pantalla de mapa usa una vista cartográfica liviana con puntos de cobertura para no bloquear el arranque cuando el proveedor de mapas no está configurado. La interfaz mantiene el modelo de datos compatible con `react-native-maps`/Heatmap y puede conectarse a ese overlay sin cambiar la capa de medición. El fallback HTTP mide latencia de aplicación; el módulo nativo es el camino TCP real requerido por la consigna.
