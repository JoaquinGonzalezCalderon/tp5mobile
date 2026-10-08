import React, {useEffect} from 'react';
import {FlatList, Text, View} from 'react-native';
import {colors, styles} from '../theme';
import {useQoSStore} from '../store/useQoSStore';
import {Chip, ChipRow, QualityBadge} from '../components/ui';
import {aggregateProbes, networkLabel} from '../services/stats';
import {DatePreset, NetworkType} from '../types';

const NETWORKS: Array<[NetworkType, string]> = [['wifi', 'Wi-Fi'], ['cellular', 'Celular'], ['ethernet', 'Ethernet'], ['none', 'Sin red']];
const DATES: Array<[DatePreset, string]> = [['all', 'Todo'], ['today', 'Hoy'], ['7d', '7 días'], ['30d', '30 días']];
const ZONES: Array<[number | null, string]> = [[null, 'Cualquier zona'], [500, '≤ 500 m'], [2000, '≤ 2 km'], [10000, '≤ 10 km']];

export function HistoryScreen() {
  const {filter, filtered, measurements, sessions, setFilter} = useQoSStore();
  useEffect(() => {
    setFilter({});
  }, [measurements.length, setFilter]);
  const toggleNetwork = (type: NetworkType) => setFilter({networkTypes: filter.networkTypes.includes(type) ? filter.networkTypes.filter(item => item !== type) : [...filter.networkTypes, type]});
  const sessionName = (id: string) => sessions.find(item => item.id === id)?.name ?? '';

  return <View style={styles.screen}>
    <Text style={[styles.title, {marginTop: 18}]}>Historial</Text>
    <Text style={styles.subtitle}>{filtered.length} de {measurements.length} mediciones (SQLite local)</Text>
    <View style={{gap: 8, marginTop: 14, marginBottom: 10}}>
      <ChipRow>
        <Chip label="Todas las redes" active={!filter.networkTypes.length} onPress={() => setFilter({networkTypes: []})} />
        {NETWORKS.map(([type, label]) => <Chip key={type} label={label} active={filter.networkTypes.includes(type)} onPress={() => toggleNetwork(type)} />)}
      </ChipRow>
      <ChipRow>
        {DATES.map(([preset, label]) => <Chip key={preset} label={label} active={filter.datePreset === preset} onPress={() => setFilter({datePreset: preset})} />)}
      </ChipRow>
      <ChipRow>
        {ZONES.map(([radius, label]) => <Chip key={label} label={label} active={filter.radiusMeters === radius} onPress={() => setFilter({radiusMeters: radius, center: null})} />)}
      </ChipRow>
      {filter.radiusMeters !== null && !filter.center && <Text style={{fontSize: 11, color: colors.muted}}>Obteniendo tu ubicación para filtrar por zona…</Text>}
    </View>
    <FlatList
      data={filtered}
      keyExtractor={item => item.id}
      contentContainerStyle={{paddingBottom: 30}}
      ListEmptyComponent={<Text style={{color: colors.muted, textAlign: 'center', marginTop: 50}}>No hay mediciones con estos filtros.</Text>}
      renderItem={({item}) => {
        const agg = aggregateProbes(item.probes);
        return <View style={[styles.card, {marginBottom: 10, paddingVertical: 13}]}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
            <View style={{flex: 1}}>
              <Text style={{fontWeight: '800', color: colors.ink}}>{networkLabel(item.network)}{item.network.carrier ? ` · ${item.network.carrier}` : ''}</Text>
              <Text style={{fontSize: 11, color: colors.muted, marginTop: 3}}>{new Date(item.timestamp).toLocaleString()} · {sessionName(item.sessionId)}{item.trigger === 'background' ? ' · 2º plano' : ''}</Text>
            </View>
            <QualityBadge quality={item.quality} />
          </View>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 11}}>
            <Stat label="RTT" value={`${Math.round(agg.avg)} ms`} />
            <Stat label="Jitter" value={`${Math.round(agg.jitter)} ms`} />
            <Stat label="Pérd." value={`${Math.round(agg.loss)}%`} />
            <Stat label="↓" value={`${item.throughput.download}`} />
            <Stat label="↑" value={`${item.throughput.upload}`} />
          </View>
          <Text style={{fontSize: 10, color: colors.muted, marginTop: 8}}>{item.location ? `${item.location.latitude.toFixed(5)}, ${item.location.longitude.toFixed(5)} (±${Math.round(item.location.accuracy ?? 0)} m)` : 'Sin ubicación'}{item.network.rssi !== undefined ? ` · ${item.network.rssi} dBm` : ''}</Text>
        </View>;
      }}
    />
  </View>;
}

function Stat({label, value}: {label: string; value: string}) {
  return <Text style={{color: colors.muted, fontSize: 12}}>{label} <Text style={{fontWeight: '800', color: colors.ink}}>{value}</Text></Text>;
}
