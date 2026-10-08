import React, {useMemo} from 'react';
import {ActivityIndicator, Pressable, ScrollView, Text, View} from 'react-native';
import {Measurement} from '../types';
import {colors, styles} from '../theme';
import {MetricCard} from '../components/MetricCard';
import {MiniChart} from '../components/MiniChart';
import {NetworkMap} from '../components/NetworkMap';

export function HomeScreen({measurements, isMeasuring, error, onMeasure}: {measurements: Measurement[]; isMeasuring: boolean; error: string | null; onMeasure: () => void}) {
  const latest = measurements[0];
  const chart = useMemo(() => measurements.slice(0, 12).reverse(), [measurements]);
  return <ScrollView style={styles.screen} contentContainerStyle={{paddingTop: 18, paddingBottom: 28}}>
    <Text style={styles.title}>Monitor QoS</Text>
    <Text style={styles.subtitle}>Estado de tu conexión en tiempo real</Text>
    <View style={[styles.card, {marginTop: 20, backgroundColor: colors.ink, borderColor: colors.ink}]}>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
        <View>
          <Text style={{color: '#AFC5EA', fontSize: 12, fontWeight: '700', textTransform: 'uppercase'}}>Red actual</Text>
          <Text style={{color: '#FFF', fontSize: 25, fontWeight: '800', marginTop: 5}}>{latest?.network.type === 'cellular' ? latest.network.generation ?? 'Celular' : latest?.network.type === 'wifi' ? 'Wi-Fi' : 'Sin medir'}</Text>
          <Text style={{color: '#AFC5EA', fontSize: 13, marginTop: 3}}>{latest?.network.carrier ?? 'Medí para detectar operador'}</Text>
        </View>
        <Text style={{fontSize: 42}}>{latest?.network.type === 'wifi' ? '◉' : '⌁'}</Text>
      </View>
      <View style={{height: 1, backgroundColor: '#30486D', marginVertical: 16}} />
      <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
        <Text style={{color: '#AFC5EA', fontSize: 12}}>Última medición</Text>
        <Text style={{color: '#FFF', fontSize: 12, fontWeight: '700'}}>{latest ? new Date(latest.timestamp).toLocaleTimeString() : 'Todavía no hay datos'}</Text>
      </View>
    </View>
    <Pressable onPress={onMeasure} disabled={isMeasuring} style={{marginTop: 14, borderRadius: 14, backgroundColor: colors.primary, padding: 16, alignItems: 'center', opacity: isMeasuring ? 0.7 : 1}}>
      {isMeasuring ? <ActivityIndicator color="#FFF" /> : <Text style={{color: '#FFF', fontWeight: '800', fontSize: 15}}>Medir ahora</Text>}
    </Pressable>
    {error && <Text style={{color: colors.red, marginTop: 10, fontSize: 12}}>{error}</Text>}
    <Text style={[styles.sectionTitle, {marginTop: 24}]}>Resumen de calidad</Text>
    <View style={{flexDirection: 'row', gap: 10}}>
      <MetricCard label="RTT promedio" value={latest ? String(Math.round(latest.probes[0]?.avg ?? 0)) : '—'} unit="ms" accent={colors.cyan} />
      <MetricCard label="Descarga" value={latest ? String(latest.throughput.download) : '—'} unit="Mbps" accent={colors.purple} />
      <MetricCard label="Pérdida" value={latest ? String(latest.probes[0]?.loss ?? 0) : '—'} unit="%" accent={colors.amber} />
    </View>
    <Text style={[styles.sectionTitle, {marginTop: 24}]}>Cobertura medida</Text>
    <NetworkMap measurements={measurements} />
    {measurements.length > 1 && <View style={[styles.card, {marginTop: 14}]}>
      <Text style={styles.sectionTitle}>Tendencia de sesiones</Text>
      <View style={{flexDirection: 'row', gap: 20}}>
        <View style={{flex: 1}}><MiniChart values={chart.map(item => item.probes[0]?.avg ?? 0)} color={colors.cyan} label="RTT / ms" /></View>
        <View style={{flex: 1}}><MiniChart values={chart.map(item => item.throughput.download)} color={colors.purple} label="Descarga / Mbps" /></View>
      </View>
    </View>}
  </ScrollView>;
}
