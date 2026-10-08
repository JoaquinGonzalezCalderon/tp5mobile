import React from 'react';
import {Pressable, ScrollView, Text, View} from 'react-native';
import Svg, {Circle, Path, Rect} from 'react-native-svg';
import {QoSStatus} from '../types';
import {colors, styles} from '../theme';

export const qualityColor: Record<QoSStatus, string> = {excellent: colors.green, good: colors.cyan, fair: colors.amber, poor: colors.red};
export const qualityLabel: Record<QoSStatus, string> = {excellent: 'Excelente', good: 'Buena', fair: 'Regular', poor: 'Pobre'};

export function MetricCard({label, value, unit, accent}: {label: string; value: string; unit?: string; accent: string}) {
  return <View style={[styles.card, {flex: 1, minWidth: 96, borderTopWidth: 3, borderTopColor: accent, paddingVertical: 14}]}>
    <Text style={styles.label} numberOfLines={1}>{label}</Text>
    <Text style={[styles.value, {marginTop: 8}]}>{value}<Text style={{fontSize: 12, color: colors.muted}}> {unit}</Text></Text>
  </View>;
}

export function Chip({label, active, onPress}: {label: string; active: boolean; onPress: () => void}) {
  return <Pressable onPress={onPress} style={{paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : '#FFF'}}>
    <Text style={{fontSize: 12, fontWeight: '700', color: active ? '#FFF' : colors.ink}}>{label}</Text>
  </Pressable>;
}

export function ChipRow({children}: {children: React.ReactNode}) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8, paddingRight: 20}}>{children}</ScrollView>;
}

export function QualityBadge({quality}: {quality: QoSStatus}) {
  return <View style={{backgroundColor: `${qualityColor[quality]}22`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12}}>
    <Text style={{color: qualityColor[quality], fontWeight: '800', fontSize: 11}}>{qualityLabel[quality].toUpperCase()}</Text>
  </View>;
}

export function SignalBars({level, color = '#FFF'}: {level?: number; color?: string}) {
  const bars = [0, 1, 2, 3];
  return <Svg width={34} height={28} viewBox="0 0 34 28">
    {bars.map(index => <Rect key={index} x={index * 9} y={20 - index * 6} width={6} height={8 + index * 6} rx={1.5} fill={color} opacity={level === undefined || index < level ? 1 : 0.25} />)}
  </Svg>;
}

export type TabIcon = 'home' | 'map' | 'chart' | 'list' | 'settings';

export function Icon({name, color, size = 24}: {name: TabIcon; color: string; size?: number}) {
  const stroke = {stroke: color, strokeWidth: 2, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const};
  return <Svg width={size} height={size} viewBox="0 0 24 24">
    {name === 'home' && <Path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" {...stroke} />}
    {name === 'map' && <><Path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" {...stroke} /><Circle cx={12} cy={9.5} r={2.5} {...stroke} /></>}
    {name === 'chart' && <><Path d="M4 20V4M4 20h16" {...stroke} /><Path d="M7 15l4-4 3 3 5-6" {...stroke} /></>}
    {name === 'list' && <Path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" {...stroke} />}
    {name === 'settings' && <><Circle cx={12} cy={12} r={3} {...stroke} /><Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" {...stroke} /></>}
  </Svg>;
}

export function SectionTitle({children, right}: {children: React.ReactNode; right?: React.ReactNode}) {
  return <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12}}>
    <Text style={[styles.sectionTitle, {marginBottom: 0}]}>{children}</Text>
    {right}
  </View>;
}
