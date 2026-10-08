import {AppRegistry} from 'react-native';
import notifee from '@notifee/react-native';
import App from './src/App';
import {registerHeadlessTask} from './src/services/background';
import {name as appName} from './app.json';

// Headless JS: permite muestrear en segundo plano con la app cerrada (Android).
registerHeadlessTask();

// Tocar la alerta con la app cerrada solo la abre; no hace falta lógica extra.
notifee.onBackgroundEvent(async () => undefined);

AppRegistry.registerComponent(appName, () => App);
