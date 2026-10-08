import {AppRegistry} from 'react-native';
import App from './src/App';
import {registerHeadlessTask} from './src/services/background';
import {name as appName} from './app.json';

// Headless JS: permite muestrear en segundo plano con la app cerrada (Android).
registerHeadlessTask();

AppRegistry.registerComponent(appName, () => App);
