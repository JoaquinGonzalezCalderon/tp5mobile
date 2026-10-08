import React from 'react';
import {Text, View} from 'react-native';
import {styles} from '../theme';

export function MetricCard({label, value, unit, accent}: {label: string; value: string; unit?: string; accent: string}) {
  return <View style={[styles.card, {flex: 1, minWidth: 100, borderTopWidth: 3, borderTopColor: accent}]}>
    <Text style={styles.label}>{label}</Text>
    <Text style={[styles.value, {marginTop: 8}]}>{value}<Text style={{fontSize: 12, color: '#6D7B90'}}> {unit}</Text></Text>
  </View>;
}
