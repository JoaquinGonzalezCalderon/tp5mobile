import React from 'react';
import {ActivityIndicator, Pressable, ScrollView, Switch, Text, View} from 'react-native';
import {colors, styles} from '../theme';
import {useQoSStore} from '../store/useQoSStore';
import {aggregateProbes, networkLabel} from '../services/stats';
import {MetricCard, QualityBadge, SectionTitle, SignalBars} from '../components/ui';

export function HomeScreen() {
  const {measurements, sessions, activeSessionId, isMeasuring, continuous, error, settings, measure, setContinuous, startSession} = useQoSStore();
  const latest = measurements[0];
  const agg = latest ? aggregateProbes(latest.probes) : null;
  const session = sessions.find(item => item.id === activeSessionId);

  return <ScrollView style={styles.screen} contentContainerStyle={{paddingTop: 18, paddingBottom: 28}}>
    <Text style={styles.title}>Monitor QoS</Text>
    <Text style={styles.subtitle}>Calidad de tu conexión en tiempo real</Text>

    <View style={[styles.card, {marginTop: 20, backgroundColor: colors.ink, borderColor: colors.ink}]}>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
        <View style={{flex: 1}}>
          <Text style={{color: '#AFC5EA', fontSize: 12, fontWeight: '700', textTransform: 'uppercase'}}>Red actual</Text>
          <Text style={{color: '#FFF', fontSize: 26, fontWeight: '800', marginTop: 5}}>{networkLabel(latest?.network)}</Text>
          <Text style={{color: '#AFC5EA', fontSize: 13, marginTop: 3}}>{latest ? latest.network.carrier ?? 'Operador no disponible' : 'Medí para detectar la red'}</Text>
        </View>
        <View style={{alignItems: 'flex-end', gap: 6}}>
          <SignalBars level={latest?.network.level} />
          {latest?.network.rssi !== undefined && <Text style={{color: '#FFF', fontSize: 12, fontWeight: '700'}}>{latest.network.rssi} dBm</Text>}
        </View>
      </View>
      <View style={{height: 1, backgroundColor: '#30486D', marginVertical: 14}} />
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
        <Text style={{color: '#AFC5EA', fontSize: 12}}>{latest ? `Última: ${new Date(latest.timestamp).toLocaleTimeString()}` : 'Todavía no hay datos'}</Text>
        {latest && <QualityBadge quality={latest.quality} />}
      </View>
    </View>

    <Pressable onPress={() => measure('manual')} disabled={isMeasuring} style={{marginTop: 14, borderRadius: 14, backgroundColor: colors.primary, padding: 16, alignItems: 'center', opacity: isMeasuring ? 0.75 : 1}}>
      {isMeasuring ? <View style={{flexDirection: 'row', gap: 10, alignItems: 'center'}}><ActivityIndicator color="#FFF" /><Text style={{color: '#FFF', fontWeight: '800'}}>Midiendo RTT y throughput…</Text></View> : <Text style={{color: '#FFF', fontWeight: '800', fontSize: 15}}>Medir ahora</Text>}
    </Pressable>
    {error && <Text style={{color: colors.red, marginTop: 10, fontSize: 12}}>{error}</Text>}

    <View style={[styles.card, {marginTop: 12}]}>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
        <View style={{flex: 1}}>
          <Text style={{fontWeight: '800', color: colors.ink}}>{session?.name ?? 'Sesión'}</Text>
          <Text style={{fontSize: 12, color: colors.muted, marginTop: 3}}>{session ? `${session.count} mediciones · desde ${new Date(session.startedAt).toLocaleString()}` : ''}</Text>
        </View>
        <Pressable onPress={startSession} style={{paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#EAF1FE'}}>
          <Text style={{color: colors.primary, fontWeight: '800', fontSize: 12}}>Nueva sesión</Text>
        </Pressable>
      </View>
      <View style={{height: 1, backgroundColor: colors.border, marginVertical: 12}} />
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
        <View style={{flex: 1}}>
          <Text style={{fontWeight: '700', color: colors.ink}}>Monitoreo continuo</Text>
          <Text style={{fontSize: 12, color: colors.muted, marginTop: 3}}>Mide cada {settings?.continuousSeconds ?? 30} s mientras la app está abierta</Text>
        </View>
        <Switch value={continuous} onValueChange={setContinuous} trackColor={{true: colors.primary}} />
      </View>
    </View>

    <SectionTitle>Resumen de calidad</SectionTitle>
    <View style={{flexDirection: 'row', gap: 10}}>
      <MetricCard label="RTT prom." value={agg ? String(Math.round(agg.avg)) : '—'} unit="ms" accent={colors.cyan} />
      <MetricCard label="Jitter" value={agg ? String(Math.round(agg.jitter * 10) / 10) : '—'} unit="ms" accent={colors.purple} />
      <MetricCard label="Pérdida" value={agg ? String(Math.round(agg.loss)) : '—'} unit="%" accent={colors.amber} />
    </View>
    <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
      <MetricCard label="Descarga" value={latest ? String(latest.throughput.download) : '—'} unit="Mbps" accent={colors.green} />
      <MetricCard label="Subida" value={latest ? String(latest.throughput.upload) : '—'} unit="Mbps" accent={colors.primary} />
    </View>

    {latest && latest.probes.length > 0 && <>
      <SectionTitle>Sondas TCP por host</SectionTitle>
      <View style={styles.card}>
        <View style={{flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border}}>
          {['Host', 'min', 'avg', 'max', 'jitter', 'pérd.'].map((head, index) => <Text key={head} style={[cell(index), {color: colors.muted, fontWeight: '700', fontSize: 11}]}>{head}</Text>)}
        </View>
        {latest.probes.map(probe => <View key={probe.host} style={{flexDirection: 'row', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F1F4F8'}}>
          <Text style={[cell(0), {fontWeight: '700', color: colors.ink}]} numberOfLines={1}>{probe.host}</Text>
          {probe.loss >= 100 ? <Text style={[cell(1), {flex: 4, color: colors.red, textAlign: 'center'}]}>sin respuesta</Text> : <>
            <Text style={cell(1)}>{Math.round(probe.min)}</Text>
            <Text style={[cell(2), {fontWeight: '800'}]}>{Math.round(probe.avg)}</Text>
            <Text style={cell(3)}>{Math.round(probe.max)}</Text>
            <Text style={cell(4)}>{Math.round(probe.jitter * 10) / 10}</Text>
          </>}
          <Text style={[cell(5), {color: probe.loss > 0 ? colors.red : colors.ink}]}>{Math.round(probe.loss)}%</Text>
        </View>)}
        <Text style={{fontSize: 11, color: colors.muted, marginTop: 8}}>{settings?.probeCount} conexiones TCP al puerto {settings?.probePort} por host · valores en ms · fuente: {latest.network.source === 'native' ? 'módulo nativo' : 'NetInfo'}</Text>
      </View>
    </>}
  </ScrollView>;
}

function cell(index: number) {
  return {flex: index === 0 ? 2.2 : 1, fontSize: 12, color: colors.ink, textAlign: index === 0 ? 'left' : 'right'} as const;
}
