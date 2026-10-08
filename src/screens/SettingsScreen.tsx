import React, {useState} from 'react';
import {Alert, Pressable, ScrollView, Switch, Text, TextInput, View} from 'react-native';
import {Settings} from '../types';
import {colors, styles} from '../theme';
import {exportMeasurements, saveSettings} from '../services/storage';

export function SettingsScreen({settings, measurements, onSave}: {settings: Settings; measurements: Parameters<typeof exportMeasurements>[0]; onSave: (settings: Settings) => void}) {
  const [draft, setDraft] = useState(settings);
  const save = async () => { await saveSettings(draft); onSave(draft); Alert.alert('Configuración guardada', 'Las próximas mediciones usarán estos valores.'); };
  const exportData = async (format: 'json' | 'csv') => { const content = await exportMeasurements(measurements, format); Alert.alert(`Exportación ${format.toUpperCase()}`, `Se generaron ${content.length} caracteres. Podés conectar Share API en la entrega final.`); };
  return <ScrollView style={styles.screen} contentContainerStyle={{paddingTop: 18, paddingBottom: 35}}>
    <Text style={styles.title}>Configuración</Text><Text style={styles.subtitle}>Ajustá la sonda y el backend de referencia</Text>
    <View style={[styles.card, {marginTop: 20}]}><Text style={styles.sectionTitle}>Backend de throughput</Text><Text style={styles.label}>URL base</Text><TextInput value={draft.backendUrl} onChangeText={backendUrl => setDraft({...draft, backendUrl})} autoCapitalize="none" keyboardType="url" style={{borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 10, color: colors.ink}} /><Text style={{fontSize: 12, color: colors.muted, marginTop: 8}}>Android emulator: http://10.0.2.2:3333 · iOS simulator: http://localhost:3333</Text></View>
    <View style={[styles.card, {marginTop: 12}]}><Text style={styles.sectionTitle}>Hosts para RTT</Text><TextInput value={draft.hosts.join(', ')} onChangeText={value => setDraft({...draft, hosts: value.split(',').map(item => item.trim()).filter(Boolean)})} autoCapitalize="none" style={{borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 10, color: colors.ink}} /><Text style={{fontSize: 12, color: colors.muted, marginTop: 8}}>Se ejecutan cuatro sondas por host y se calcula pérdida, min, promedio, máximo y jitter.</Text></View>
    <View style={[styles.card, {marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}]}><View><Text style={{fontWeight: '800', color: colors.ink}}>Muestreo en segundo plano</Text><Text style={{fontSize: 12, color: colors.muted, marginTop: 4}}>Intervalo: {draft.intervalMinutes} minutos</Text></View><Switch value={draft.backgroundEnabled} onValueChange={backgroundEnabled => setDraft({...draft, backgroundEnabled})} trackColor={{true: colors.primary}} /></View>
    <Pressable onPress={save} style={{marginTop: 18, backgroundColor: colors.primary, padding: 15, borderRadius: 13, alignItems: 'center'}}><Text style={{color: '#FFF', fontWeight: '800'}}>Guardar cambios</Text></Pressable>
    <Text style={[styles.sectionTitle, {marginTop: 26}]}>Exportar historial</Text>
    <View style={{flexDirection: 'row', gap: 10}}><Pressable onPress={() => exportData('csv')} style={[styles.card, {flex: 1, alignItems: 'center'}]}><Text style={{color: colors.primary, fontWeight: '800'}}>Exportar CSV</Text></Pressable><Pressable onPress={() => exportData('json')} style={[styles.card, {flex: 1, alignItems: 'center'}]}><Text style={{color: colors.primary, fontWeight: '800'}}>Exportar JSON</Text></Pressable></View>
  </ScrollView>;
}
