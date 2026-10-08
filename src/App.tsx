import React, {useState} from 'react';
import {SafeAreaView, Text, View} from 'react-native';
import {HomeScreen} from './screens/HomeScreen';
import {HistoryScreen} from './screens/HistoryScreen';
import {SettingsScreen} from './screens/SettingsScreen';
import {useMonitor} from './hooks/useMonitor';
import {colors} from './theme';

type Tab = 'home' | 'history' | 'settings';

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const monitor = useMonitor();
  if (!monitor.settings) return <SafeAreaView style={{flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center'}}><Text style={{color: colors.muted}}>Cargando monitor…</Text></SafeAreaView>;
  return <SafeAreaView style={{flex: 1, backgroundColor: colors.background}}>
    <View style={{flex: 1}}>{tab === 'home' ? <HomeScreen measurements={monitor.measurements} isMeasuring={monitor.isMeasuring} error={monitor.error} onMeasure={monitor.measure} /> : tab === 'history' ? <HistoryScreen measurements={monitor.measurements} /> : <SettingsScreen settings={monitor.settings} measurements={monitor.measurements} onSave={monitor.updateSettings} />}</View>
    <View style={{height: 70, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center'}}>
      {([['home', '⌂', 'Inicio'], ['history', '◷', 'Historial'], ['settings', '⚙', 'Ajustes']] as const).map(([key, icon, label]) => <Text key={key} onPress={() => setTab(key)} style={{textAlign: 'center', color: tab === key ? colors.primary : colors.muted, fontSize: 12, fontWeight: '700', minWidth: 80}}><Text style={{fontSize: 24}}>{icon}</Text>{'\n'}{label}</Text>)}
    </View>
  </SafeAreaView>;
}
