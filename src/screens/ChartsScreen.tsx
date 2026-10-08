import React, {useMemo, useState} from 'react';
import {ScrollView, Text, View} from 'react-native';
import {colors, styles} from '../theme';
import {useQoSStore} from '../store/useQoSStore';
import {LineChart} from '../components/LineChart';
import {Chip, ChipRow, MetricCard} from '../components/ui';
import {aggregateProbes, round} from '../services/stats';

export function ChartsScreen() {
  const {measurements, sessions, activeSessionId} = useQoSStore();
  const withData = sessions.filter(item => item.count > 0);
  const [selected, setSelected] = useState<string | null>(null);
  const sessionId = selected ?? (withData.some(item => item.id === activeSessionId) ? activeSessionId : withData[0]?.id ?? null);
  const session = sessions.find(item => item.id === sessionId);
  const points = useMemo(() => measurements.filter(item => item.sessionId === sessionId).slice().reverse(), [measurements, sessionId]);
  const probes = points.map(item => aggregateProbes(item.probes));
  const timestamps = points.map(item => item.timestamp);
  const avg = (values: number[]) => (values.length ? round(values.reduce((a, b) => a + b, 0) / values.length, 1) : 0);

  return <ScrollView style={styles.screen} contentContainerStyle={{paddingTop: 18, paddingBottom: 28}}>
    <Text style={styles.title}>Series temporales</Text>
    <Text style={styles.subtitle}>Latencia y throughput por sesión de medición</Text>
    <View style={{marginTop: 16}}>
      <ChipRow>
        {withData.map(item => <Chip key={item.id} label={item.name} active={item.id === sessionId} onPress={() => setSelected(item.id)} />)}
      </ChipRow>
    </View>
    {session && <Text style={{fontSize: 12, color: colors.muted, marginTop: 10}}>{points.length} mediciones · {new Date(session.startedAt).toLocaleString()}</Text>}

    <View style={{flexDirection: 'row', gap: 10, marginTop: 14}}>
      <MetricCard label="RTT medio" value={String(avg(probes.map(p => p.avg)))} unit="ms" accent={colors.cyan} />
      <MetricCard label="↓ medio" value={String(avg(points.map(p => p.throughput.download)))} unit="Mbps" accent={colors.green} />
      <MetricCard label="↑ medio" value={String(avg(points.map(p => p.throughput.upload)))} unit="Mbps" accent={colors.primary} />
    </View>

    <View style={[styles.card, {marginTop: 14}]}>
      <Text style={styles.sectionTitle}>Latencia</Text>
      <LineChart unit="ms" timestamps={timestamps} series={[
        {label: 'RTT promedio', color: colors.cyan, values: probes.map(p => p.avg)},
        {label: 'Jitter', color: colors.purple, values: probes.map(p => p.jitter)},
      ]} />
    </View>
    <View style={[styles.card, {marginTop: 12}]}>
      <Text style={styles.sectionTitle}>Throughput</Text>
      <LineChart unit="Mbps" timestamps={timestamps} series={[
        {label: 'Descarga', color: colors.green, values: points.map(p => p.throughput.download)},
        {label: 'Subida', color: colors.primary, values: points.map(p => p.throughput.upload)},
      ]} />
    </View>
    <View style={[styles.card, {marginTop: 12}]}>
      <Text style={styles.sectionTitle}>Pérdida de paquetes</Text>
      <LineChart unit="%" timestamps={timestamps} height={130} series={[{label: 'Pérdida', color: colors.red, values: probes.map(p => p.loss)}]} />
    </View>
  </ScrollView>;
}
