import React, {useState} from 'react';
import {LayoutChangeEvent, Text, View} from 'react-native';
import Svg, {Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText} from 'react-native-svg';
import {colors} from '../theme';

export type Series = {label: string; color: string; values: number[]};

/** Serie temporal en SVG: eje Y con 3 marcas, eje X con hora de inicio y fin, área bajo la primera serie. */
export function LineChart({series, timestamps, unit, height = 170}: {series: Series[]; timestamps: string[]; unit: string; height?: number}) {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const padding = {left: 38, right: 10, top: 12, bottom: 24};
  const all = series.flatMap(item => item.values);
  const max = niceMax(Math.max(...all, 1));
  const count = Math.max(...series.map(item => item.values.length), 0);
  const innerW = Math.max(width - padding.left - padding.right, 1);
  const innerH = height - padding.top - padding.bottom;
  const x = (index: number) => padding.left + (count <= 1 ? innerW / 2 : (index / (count - 1)) * innerW);
  const y = (value: number) => padding.top + innerH - (value / max) * innerH;
  const time = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '');

  return <View onLayout={onLayout}>
    {width > 0 && count > 0 && <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={series[0]?.color} stopOpacity="0.25" />
          <Stop offset="1" stopColor={series[0]?.color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      {[0, 0.5, 1].map(fraction => <React.Fragment key={fraction}>
        <Line x1={padding.left} x2={width - padding.right} y1={y(max * fraction)} y2={y(max * fraction)} stroke={colors.border} strokeWidth={1} />
        <SvgText x={padding.left - 6} y={y(max * fraction) + 4} fontSize={10} fill={colors.muted} textAnchor="end">{formatTick(max * fraction)}</SvgText>
      </React.Fragment>)}
      <SvgText x={padding.left} y={height - 6} fontSize={10} fill={colors.muted}>{time(timestamps[0])}</SvgText>
      <SvgText x={width - padding.right} y={height - 6} fontSize={10} fill={colors.muted} textAnchor="end">{time(timestamps[timestamps.length - 1])}</SvgText>
      {series[0] && series[0].values.length > 1 && <Path d={`${linePath(series[0].values, x, y)} L ${x(series[0].values.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`} fill="url(#area)" />}
      {series.map(item => <React.Fragment key={item.label}>
        <Path d={linePath(item.values, x, y)} stroke={item.color} strokeWidth={2.4} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {item.values.length <= 40 && item.values.map((value, index) => <Circle key={index} cx={x(index)} cy={y(value)} r={2.8} fill="#FFF" stroke={item.color} strokeWidth={1.8} />)}
      </React.Fragment>)}
    </Svg>}
    {count === 0 && <Text style={{color: colors.muted, fontSize: 12, paddingVertical: 30, textAlign: 'center'}}>Sin datos en esta sesión</Text>}
    <View style={{flexDirection: 'row', gap: 14, marginTop: 4, flexWrap: 'wrap'}}>
      {series.map(item => <View key={item.label} style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
        <View style={{width: 12, height: 3, borderRadius: 2, backgroundColor: item.color}} />
        <Text style={{fontSize: 11, color: colors.muted}}>{item.label} ({unit})</Text>
      </View>)}
    </View>
  </View>;
}

function linePath(values: number[], x: (index: number) => number, y: (value: number) => number): string {
  return values.map((value, index) => `${index ? 'L' : 'M'} ${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(' ');
}

function niceMax(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function formatTick(value: number): string {
  return value >= 100 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
}
