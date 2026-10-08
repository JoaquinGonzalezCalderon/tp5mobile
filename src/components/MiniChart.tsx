import React from 'react';
import {Text, View} from 'react-native';
import {colors} from '../theme';

export function MiniChart({values, color, label}: {values: number[]; color: string; label: string}) {
  const max = Math.max(...values, 1);
  return <View style={{marginTop: 8}}>
    <View style={{height: 82, flexDirection: 'row', alignItems: 'flex-end', gap: 5}}>
      {values.slice(-12).map((value, index) => <View key={`${value}-${index}`} style={{flex: 1, height: `${Math.max(8, (value / max) * 100)}%`, backgroundColor: color, borderRadius: 5, opacity: 0.8}} />)}
    </View>
    <Text style={{fontSize: 11, color: colors.muted, marginTop: 6}}>{label}</Text>
  </View>;
}
