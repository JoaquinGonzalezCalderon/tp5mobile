import React from 'react';
import {Text, View} from 'react-native';
import {Measurement} from '../types';
import {colors} from '../theme';

export function NetworkMap({measurements}: {measurements: Measurement[]}) {
  const located = measurements.filter(item => item.location);
  return <View style={{height: 220, borderRadius: 16, overflow: 'hidden', backgroundColor: '#DCEBFA', position: 'relative'}}>
    <View style={{position: 'absolute', left: 0, right: 0, top: 42, height: 1, backgroundColor: '#BBD4E8'}} />
    <View style={{position: 'absolute', left: 0, right: 0, top: 112, height: 1, backgroundColor: '#BBD4E8'}} />
    <View style={{position: 'absolute', left: 0, right: 0, top: 178, height: 1, backgroundColor: '#BBD4E8'}} />
    <View style={{position: 'absolute', top: 0, bottom: 0, left: '28%', width: 1, backgroundColor: '#BBD4E8'}} />
    <View style={{position: 'absolute', top: 0, bottom: 0, left: '66%', width: 1, backgroundColor: '#BBD4E8'}} />
    <View style={{position: 'absolute', top: 88, left: 28, width: 220, height: 46, backgroundColor: '#C4E0D2', opacity: 0.75, transform: [{rotate: '-18deg'}]}} />
    <View style={{position: 'absolute', top: 146, left: 120, width: 230, height: 34, backgroundColor: '#F4D89B', opacity: 0.72, transform: [{rotate: '14deg'}]}} />
    {located.slice(0, 80).map((item, index) => {
      const lat = item.location?.latitude ?? 0;
      const lng = item.location?.longitude ?? 0;
      const left = `${8 + ((Math.abs(lng * 13 + index * 7) % 84))}%` as `${number}%`;
      const top = `${16 + ((Math.abs(lat * 17 + index * 11) % 70))}%` as `${number}%`;
      const color = item.quality === 'excellent' ? colors.green : item.quality === 'good' ? colors.cyan : item.quality === 'fair' ? colors.amber : colors.red;
      return <View key={item.id} style={{position: 'absolute', left, top, width: 14, height: 14, borderRadius: 7, backgroundColor: color, borderWidth: 2, borderColor: '#FFF', shadowColor: color, shadowOpacity: 0.7, shadowRadius: 8}} />;
    })}
    <View style={{position: 'absolute', left: 12, bottom: 12, backgroundColor: 'rgba(255,255,255,.9)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9}}>
      <Text style={{fontSize: 12, fontWeight: '700', color: colors.ink}}>Mapa de cobertura</Text>
      <Text style={{fontSize: 11, color: colors.muted}}>{located.length} puntos georreferenciados</Text>
    </View>
  </View>;
}
