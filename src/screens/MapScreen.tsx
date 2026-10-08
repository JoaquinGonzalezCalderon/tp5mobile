import React, {useMemo, useState} from 'react';
import {ScrollView, Text, View} from 'react-native';
import {colors, styles} from '../theme';
import {useQoSStore} from '../store/useQoSStore';
import {CoverageMap, HeatMode} from '../components/CoverageMap';
import {Chip, ChipRow, qualityColor, qualityLabel} from '../components/ui';
import {QoSStatus} from '../types';

export function MapScreen() {
  const {measurements, sessions} = useQoSStore();
  const [mode, setMode] = useState<HeatMode>('quality');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [markers, setMarkers] = useState(true);
  const visible = useMemo(() => (sessionId ? measurements.filter(item => item.sessionId === sessionId) : measurements), [measurements, sessionId]);
  const located = visible.filter(item => item.location);
  const counts = located.reduce<Record<string, number>>((acc, item) => ({...acc, [item.quality]: (acc[item.quality] ?? 0) + 1}), {});

  return <ScrollView style={styles.screen} contentContainerStyle={{paddingTop: 18, paddingBottom: 28}} nestedScrollEnabled>
    <Text style={styles.title}>Mapa de cobertura</Text>
    <Text style={styles.subtitle}>Heatmap construido con tus propias mediciones</Text>

    <View style={{marginTop: 16}}>
      <ChipRow>
        <Chip label="Calidad QoS" active={mode === 'quality'} onPress={() => setMode('quality')} />
        <Chip label="Señal (RSSI)" active={mode === 'rssi'} onPress={() => setMode('rssi')} />
        <Chip label="Latencia" active={mode === 'rtt'} onPress={() => setMode('rtt')} />
        <Chip label={markers ? 'Ocultar puntos' : 'Mostrar puntos'} active={false} onPress={() => setMarkers(!markers)} />
      </ChipRow>
    </View>
    <View style={{marginTop: 10}}>
      <ChipRow>
        <Chip label="Todas las sesiones" active={!sessionId} onPress={() => setSessionId(null)} />
        {sessions.filter(item => item.count > 0).map(item => <Chip key={item.id} label={`${item.name} (${item.count})`} active={sessionId === item.id} onPress={() => setSessionId(item.id)} />)}
      </ChipRow>
    </View>

    <View style={{marginTop: 14}}>
      <CoverageMap measurements={visible} mode={mode} showMarkers={markers} height={420} />
    </View>

    <View style={[styles.card, {marginTop: 14}]}>
      <Text style={styles.sectionTitle}>{located.length} puntos georreferenciados</Text>
      <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 14}}>
        {(['excellent', 'good', 'fair', 'poor'] as QoSStatus[]).map(quality => <View key={quality} style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
          <View style={{width: 10, height: 10, borderRadius: 5, backgroundColor: qualityColor[quality]}} />
          <Text style={{fontSize: 12, color: colors.ink}}>{qualityLabel[quality]}: <Text style={{fontWeight: '800'}}>{counts[quality] ?? 0}</Text></Text>
        </View>)}
      </View>
      <Text style={{fontSize: 11, color: colors.muted, marginTop: 10}}>La intensidad se promedia por celdas de ~30 m para que muchas mediciones en el mismo lugar no se confundan con mejor calidad. Tocá un punto para ver su detalle.</Text>
    </View>
  </ScrollView>;
}
