import React, {useMemo, useState} from 'react';
import {FlatList, Text, TextInput, View} from 'react-native';
import {Measurement} from '../types';
import {colors, styles} from '../theme';

export function HistoryScreen({measurements}: {measurements: Measurement[]}) {
  const [filter, setFilter] = useState('');
  const filtered = useMemo(() => measurements.filter(item => `${item.network.type} ${item.network.carrier ?? ''} ${item.quality}`.toLowerCase().includes(filter.toLowerCase())), [filter, measurements]);
  return <View style={styles.screen}>
    <Text style={[styles.title, {marginTop: 18}]}>Historial</Text>
    <Text style={styles.subtitle}>{measurements.length} mediciones guardadas localmente</Text>
    <TextInput value={filter} onChangeText={setFilter} placeholder="Filtrar por red o calidad" placeholderTextColor="#98A4B5" style={{backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, marginVertical: 16, color: colors.ink}} />
    <FlatList data={filtered} keyExtractor={item => item.id} contentContainerStyle={{paddingBottom: 30}} ListEmptyComponent={<Text style={{color: colors.muted, textAlign: 'center', marginTop: 60}}>Aún no hay mediciones. Ejecutá la primera desde Inicio.</Text>} renderItem={({item}) => <View style={[styles.card, {marginBottom: 10}]}>
      <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
        <View><Text style={{fontWeight: '800', color: colors.ink}}>{item.network.type === 'cellular' ? item.network.generation ?? 'Celular' : item.network.type === 'wifi' ? 'Wi-Fi' : item.network.type}</Text><Text style={{fontSize: 12, color: colors.muted, marginTop: 4}}>{new Date(item.timestamp).toLocaleString()}</Text></View>
        <Text style={{fontWeight: '800', color: item.quality === 'poor' ? colors.red : item.quality === 'fair' ? colors.amber : colors.green}}>{item.quality.toUpperCase()}</Text>
      </View>
      <View style={{flexDirection: 'row', gap: 22, marginTop: 14}}><Text style={{color: colors.muted}}>RTT <Text style={{fontWeight: '800', color: colors.ink}}>{Math.round(item.probes[0]?.avg ?? 0)} ms</Text></Text><Text style={{color: colors.muted}}>↓ <Text style={{fontWeight: '800', color: colors.ink}}>{item.throughput.download} Mbps</Text></Text><Text style={{color: colors.muted}}>↑ <Text style={{fontWeight: '800', color: colors.ink}}>{item.throughput.upload} Mbps</Text></Text></View>
    </View>} />
  </View>;
}
