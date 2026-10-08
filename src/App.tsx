import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, SafeAreaView, StatusBar, Text, View} from 'react-native';
import {HomeScreen} from './screens/HomeScreen';
import {MapScreen} from './screens/MapScreen';
import {ChartsScreen} from './screens/ChartsScreen';
import {HistoryScreen} from './screens/HistoryScreen';
import {SettingsScreen} from './screens/SettingsScreen';
import {useQoSStore} from './store/useQoSStore';
import {Icon, TabIcon} from './components/ui';
import {colors} from './theme';

type Tab = 'home' | 'map' | 'charts' | 'history' | 'settings';

const TABS: Array<[Tab, TabIcon, string]> = [
  ['home', 'home', 'Inicio'],
  ['map', 'map', 'Mapa'],
  ['charts', 'chart', 'Gráficos'],
  ['history', 'list', 'Historial'],
  ['settings', 'settings', 'Ajustes'],
];

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const ready = useQoSStore(state => state.ready);
  const init = useQoSStore(state => state.init);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    init().catch(error => setInitError(error instanceof Error ? error.message : String(error)));
  }, [init]);

  if (!ready) {
    return <SafeAreaView style={{flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24}}>
      {initError ? <Text style={{color: colors.red, textAlign: 'center'}}>No se pudo iniciar la base de datos: {initError}</Text> : <><ActivityIndicator color={colors.primary} /><Text style={{color: colors.muted, marginTop: 10}}>Cargando monitor…</Text></>}
    </SafeAreaView>;
  }

  return <SafeAreaView style={{flex: 1, backgroundColor: colors.background}}>
    <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
    <View style={{flex: 1}}>
      {tab === 'home' && <HomeScreen />}
      {tab === 'map' && <MapScreen />}
      {tab === 'charts' && <ChartsScreen />}
      {tab === 'history' && <HistoryScreen />}
      {tab === 'settings' && <SettingsScreen />}
    </View>
    <View style={{height: 64, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: '#FFF', flexDirection: 'row'}}>
      {TABS.map(([key, icon, label]) => {
        const active = tab === key;
        return <Pressable key={key} onPress={() => setTab(key)} style={{flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3}}>
          <Icon name={icon} color={active ? colors.primary : colors.muted} size={22} />
          <Text style={{fontSize: 11, fontWeight: '700', color: active ? colors.primary : colors.muted}}>{label}</Text>
        </Pressable>;
      })}
    </View>
  </SafeAreaView>;
}
