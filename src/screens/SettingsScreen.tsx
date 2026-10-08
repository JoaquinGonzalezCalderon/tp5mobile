import React, {useState} from 'react';
import {Alert, Pressable, ScrollView, Switch, Text, TextInput, View} from 'react-native';
import {colors, styles} from '../theme';
import {useQoSStore} from '../store/useQoSStore';
import {exportMeasurements} from '../services/export';
import {hasNativeModule} from '../services/native';
import {Settings} from '../types';

export function SettingsScreen() {
  const {settings, measurements, filtered, updateSettings, clearHistory} = useQoSStore();
  const [draft, setDraft] = useState<Settings>(settings!);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    await updateSettings(draft);
    Alert.alert('Configuración guardada', draft.backgroundEnabled ? `Muestreo en segundo plano activo cada ${Math.max(15, draft.intervalMinutes)} min.` : 'Las próximas mediciones usarán estos valores.');
  };
  const doExport = async (format: 'csv' | 'json', onlyFiltered: boolean) => {
    const data = onlyFiltered ? filtered : measurements;
    if (!data.length) return Alert.alert('Sin datos', 'No hay mediciones para exportar.');
    setBusy(true);
    try {
      await exportMeasurements(data, format);
    } catch (error) {
      Alert.alert('No se pudo exportar', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  const confirmClear = () => Alert.alert('Borrar historial', 'Se eliminan todas las mediciones y sesiones guardadas.', [
    {text: 'Cancelar', style: 'cancel'},
    {text: 'Borrar', style: 'destructive', onPress: clearHistory},
  ]);
  const num = (value: string, fallback: number) => (Number.isFinite(Number(value)) && value !== '' ? Number(value) : fallback);

  return <ScrollView style={styles.screen} contentContainerStyle={{paddingTop: 18, paddingBottom: 35}} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>Ajustes</Text>
    <Text style={styles.subtitle}>Sondas, backend de referencia y alertas</Text>

    <View style={[styles.card, {marginTop: 20}]}>
      <Text style={styles.sectionTitle}>Backend de throughput</Text>
      <Field label="URL base" value={draft.backendUrl} onChange={backendUrl => setDraft({...draft, backendUrl})} keyboardType="url" />
      <Text style={styles.hint}>Emulador Android: http://10.0.2.2:3333 · Celular: http://IP-de-tu-PC:3333 o la URL del backend desplegado</Text>
    </View>

    <View style={[styles.card, {marginTop: 12}]}>
      <Text style={styles.sectionTitle}>Sondas RTT</Text>
      <Field label="Hosts (separados por coma)" value={draft.hosts.join(', ')} onChange={value => setDraft({...draft, hosts: value.split(',').map(item => item.trim()).filter(Boolean)})} />
      <View style={{flexDirection: 'row', gap: 16}}>
        <View style={{flex: 1}}><Field label="Puerto TCP" value={String(draft.probePort)} onChange={value => setDraft({...draft, probePort: num(value, 443)})} keyboardType="number-pad" /></View>
        <View style={{flex: 1}}><Field label="Sondas por host" value={String(draft.probeCount)} onChange={value => setDraft({...draft, probeCount: Math.min(10, num(value, 5))})} keyboardType="number-pad" /></View>
      </View>
      <Text style={styles.hint}>Módulo nativo {hasNativeModule ? 'activo: sockets TCP reales' : 'no disponible: se usan sondas HTTP'}</Text>
    </View>

    <View style={[styles.card, {marginTop: 12}]}>
      <Text style={styles.sectionTitle}>Muestreo y alertas</Text>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
        <View style={{flex: 1}}>
          <Text style={{fontWeight: '700', color: colors.ink}}>Segundo plano</Text>
          <Text style={styles.hint}>Sigue midiendo con la app cerrada o el teléfono bloqueado</Text>
        </View>
        <Switch value={draft.backgroundEnabled} onValueChange={backgroundEnabled => setDraft({...draft, backgroundEnabled})} trackColor={{true: colors.primary}} />
      </View>
      <View style={{flexDirection: 'row', gap: 16}}>
        <View style={{flex: 1}}><Field label="Intervalo 2º plano (min)" value={String(draft.intervalMinutes)} onChange={value => setDraft({...draft, intervalMinutes: num(value, 15)})} keyboardType="number-pad" /></View>
        <View style={{flex: 1}}><Field label="Continuo (s)" value={String(draft.continuousSeconds)} onChange={value => setDraft({...draft, continuousSeconds: num(value, 30)})} keyboardType="number-pad" /></View>
      </View>
      <View style={{flexDirection: 'row', gap: 16}}>
        <View style={{flex: 1}}><Field label="Alerta RTT ≥ (ms)" value={String(draft.alertRttMs)} onChange={value => setDraft({...draft, alertRttMs: num(value, 250)})} keyboardType="number-pad" /></View>
        <View style={{flex: 1}}><Field label="Alerta pérdida ≥ (%)" value={String(draft.alertLossPct)} onChange={value => setDraft({...draft, alertLossPct: num(value, 20)})} keyboardType="number-pad" /></View>
      </View>
      <Text style={styles.hint}>Android e iOS imponen un mínimo de 15 minutos entre ejecuciones en segundo plano.</Text>
    </View>

    <Pressable onPress={save} style={{marginTop: 16, backgroundColor: colors.primary, padding: 15, borderRadius: 13, alignItems: 'center'}}>
      <Text style={{color: '#FFF', fontWeight: '800'}}>Guardar cambios</Text>
    </Pressable>

    <Text style={[styles.sectionTitle, {marginTop: 26}]}>Exportar historial</Text>
    <View style={{flexDirection: 'row', gap: 10}}>
      <ExportButton label="CSV completo" disabled={busy} onPress={() => doExport('csv', false)} />
      <ExportButton label="JSON completo" disabled={busy} onPress={() => doExport('json', false)} />
    </View>
    <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
      <ExportButton label={`CSV filtrado (${filtered.length})`} disabled={busy} onPress={() => doExport('csv', true)} />
      <ExportButton label={`JSON filtrado (${filtered.length})`} disabled={busy} onPress={() => doExport('json', true)} />
    </View>
    <Text style={styles.hint}>El archivo se guarda en el almacenamiento de la app y se abre la hoja de compartir (Drive, mail, WhatsApp…). "Filtrado" usa los filtros del Historial.</Text>

    <Pressable onPress={confirmClear} style={{marginTop: 24, padding: 13, borderRadius: 13, alignItems: 'center', borderWidth: 1, borderColor: colors.red}}>
      <Text style={{color: colors.red, fontWeight: '800'}}>Borrar historial</Text>
    </Pressable>
  </ScrollView>;
}

function Field({label, value, onChange, keyboardType}: {label: string; value: string; onChange: (value: string) => void; keyboardType?: 'url' | 'number-pad'}) {
  return <View style={{marginBottom: 6}}>
    <Text style={[styles.label, {marginTop: 8}]}>{label}</Text>
    <TextInput value={value} onChangeText={onChange} autoCapitalize="none" autoCorrect={false} keyboardType={keyboardType ?? 'default'} style={{borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 8, color: colors.ink, fontSize: 15}} />
  </View>;
}

function ExportButton({label, onPress, disabled}: {label: string; onPress: () => void; disabled: boolean}) {
  return <Pressable onPress={onPress} disabled={disabled} style={[styles.card, {flex: 1, alignItems: 'center', paddingVertical: 14, opacity: disabled ? 0.5 : 1}]}>
    <Text style={{color: colors.primary, fontWeight: '800', fontSize: 13}}>{label}</Text>
  </Pressable>;
}
