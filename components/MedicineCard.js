/**
 * CanBakım — MedicineCard
 * React.memo ile sarılmış — sadece ilgili prop değişince yeniden render olur
 * MedicinesScreen ve HomeScreen paylaşır
 */
import { memo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { COLORS, FONTS, RADIUS, SHADOW } from '../lib/theme'
import { SpeakablePress } from '../lib/SpeechContext'

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const TODAY = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]

const MedicineCard = memo(function MedicineCard({ med, isTaken, colors, onMarkTaken, onDelete }) {
  const isToday = med.days?.includes(TODAY)
  const medColor = med.color || '#4361EE'

  function buildSpeech() {
    let t = med.name + '. '
    if (med.dose) t += 'Doz: ' + med.dose + '. '
    if (med.note) t += med.note + '. '
    t += 'Günler: ' + (med.days || []).join(', ') + '. '
    t += 'Saatler: ' + (med.times || []).join(', ')
    return t
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderLeftColor: medColor }]}>
      {/* BAŞLIK */}
      <View style={styles.cardHeader}>
        <View style={[styles.iconBox, { backgroundColor: medColor + '22' }]}>
          <Text style={styles.icon}>{med.icon || '💊'}</Text>
        </View>
        <SpeakablePress text={buildSpeech()} speakOnly style={styles.info}>
          <Text style={[styles.name, { color: colors.text }]}>{med.name}</Text>
          {med.dose ? <Text style={[styles.dose, { color: colors.textMuted }]}>{med.dose}</Text> : null}
          {med.note ? <Text style={[styles.note, { color: colors.textMuted }]}>{med.note}</Text> : null}
        </SpeakablePress>
        {isToday && (
          <LinearGradient
            colors={isTaken ? ['#06D6A0', '#4CC9F0'] : [medColor, '#7209B7']}
            style={styles.badge}
          >
            <Text style={styles.badgeText}>{isTaken ? '✅ Alındı' : '📅 Bugün'}</Text>
          </LinearGradient>
        )}
      </View>

      {/* GÜNLER */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Günler</Text>
      <View style={styles.daysRow}>
        {(med.days || []).map(d => (
          <View key={d} style={[
            styles.dayChip,
            { backgroundColor: d === TODAY ? medColor + '22' : colors.border }
          ]}>
            <Text style={[
              styles.dayText,
              { color: d === TODAY ? medColor : colors.textMuted, fontWeight: d === TODAY ? '900' : '700' }
            ]}>{d}</Text>
          </View>
        ))}
      </View>

      {/* SAATLER */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Saatler</Text>
      <View style={styles.timesRow}>
        {(med.times || []).map(t => (
          <View key={t} style={[styles.timeChip, { backgroundColor: medColor + '15' }]}>
            <Text style={[styles.timeText, { color: medColor }]}>⏰ {t}</Text>
          </View>
        ))}
      </View>

      {/* BUTONLAR */}
      <View style={styles.actions}>
        <SpeakablePress
          text={isTaken ? med.name + ' alındı işareti kaldırılıyor' : med.name + ' alındı olarak işaretleniyor'}
          onPress={() => onMarkTaken(med)}
          style={[styles.takenBtn, { backgroundColor: isTaken ? '#E8FBF5' : colors.bg }]}
          activeOpacity={0.8}
        >
          {isTaken ? (
            <LinearGradient colors={[COLORS.success, '#06D6A0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.takenGradient}>
              <Text style={styles.takenTextActive}>✅ Alındı</Text>
            </LinearGradient>
          ) : (
            <Text style={[styles.takenText, { color: colors.text }]}>✓ Alındı İşaretle</Text>
          )}
        </SpeakablePress>
        {onDelete && (
          <SpeakablePress
            text={med.name + ' siliniyor'}
            onPress={() => onDelete(med.id)}
            style={styles.deleteBtn}
          >
            <Text style={styles.deleteIcon}>🗑️</Text>
          </SpeakablePress>
        )}
      </View>
    </View>
  )
}, (prevProps, nextProps) => {
  // Sadece şu değişkenlerde re-render yap:
  return prevProps.isTaken === nextProps.isTaken &&
         prevProps.med.id === nextProps.med.id &&
         prevProps.colors === nextProps.colors
})

export default MedicineCard

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.lg, padding: 16, marginBottom: 14, borderLeftWidth: 4, ...SHADOW.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 24 },
  info: { flex: 1 },
  name: { fontSize: FONTS.md, fontWeight: '800' },
  dose: { fontSize: FONTS.xs, marginTop: 1 },
  note: { fontSize: FONTS.xs, marginTop: 1 },
  badge: { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontWeight: '800', color: 'white' },
  sectionLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  daysRow: { flexDirection: 'row', gap: 4, marginBottom: 10, flexWrap: 'wrap' },
  dayChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  dayText: { fontSize: 11 },
  timesRow: { flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' },
  timeChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  timeText: { fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8 },
  takenBtn: { flex: 1, borderRadius: RADIUS.sm, overflow: 'hidden' },
  takenGradient: { padding: 10, alignItems: 'center' },
  takenText: { fontSize: FONTS.sm, fontWeight: '800', textAlign: 'center', paddingVertical: 10 },
  takenTextActive: { fontSize: FONTS.sm, fontWeight: '800', color: 'white' },
  deleteBtn: { backgroundColor: '#FFE8E8', borderRadius: RADIUS.sm, padding: 10, paddingHorizontal: 14, justifyContent: 'center' },
  deleteIcon: { fontSize: 16 },
})