import {StyleSheet} from 'react-native';

export const colors = {
  ink: '#10233F',
  muted: '#6D7B90',
  primary: '#2164F3',
  primaryDark: '#1548B9',
  background: '#F5F7FB',
  card: '#FFFFFF',
  border: '#E4EAF2',
  cyan: '#00B8D9',
  green: '#14A77A',
  amber: '#E89A18',
  red: '#D94A5B',
  purple: '#7557D9',
};

export const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.background},
  screen: {flex: 1, paddingHorizontal: 20},
  title: {fontSize: 28, fontWeight: '800', color: colors.ink, letterSpacing: -0.6},
  subtitle: {fontSize: 14, color: colors.muted, marginTop: 5},
  card: {backgroundColor: colors.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.border},
  sectionTitle: {fontSize: 16, fontWeight: '800', color: colors.ink, marginBottom: 12},
  label: {fontSize: 12, fontWeight: '700', letterSpacing: 0.4, color: colors.muted, textTransform: 'uppercase'},
  value: {fontSize: 20, fontWeight: '800', color: colors.ink},
});
