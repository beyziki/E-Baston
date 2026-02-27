import { useState, useRef, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, Modal, Animated } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { COLORS, FONTS, RADIUS, SHADOW } from '../lib/theme'
import { useTheme } from '../lib/ThemeContext'
import { SpeakablePress, SpeechToggleButton } from '../lib/SpeechContext'
import { useHealthRecords } from '../lib/useData'

function AnimatedCard({ children, delay = 0, style }) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 500, delay, useNativeDriver: true }).start()
  }, [])
  return (
    <Animated.View style={[{
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
    }, style]}>
      {children}
    </Animated.View>
  )
}

export default function HealthScreen() {
  const [showModal, setShowModal]         = useState(false)
  const [bloodPressure, setBloodPressure] = useState('')
  const [bloodSugar, setBloodSugar]       = useState('')
  const [pulse, setPulse]                 = useState('')
  const [weight, setWeight]               = useState('')
  const { colors } = useTheme()

  // ── Hook ─────────────────────────────────────────────────────────
  const { records, latest, loading, addRecord } = useHealthRecords()

  async function handleAddRecord() {
    if (!bloodPressure && !bloodSugar && !pulse && !weight) {
      Alert.alert('Hata', 'En az bir değer giriniz'); return
    }
    const result = await addRecord({
      blood_pressure: bloodPressure || null,
      blood_sugar: bloodSugar ? parseInt(bloodSugar) : null,
      pulse: pulse ? parseInt(pulse) : null,
      weight: weight ? parseFloat(weight) : null,
    })
    if (!result.success) { Alert.alert('Hata', result.error); return }
    setBloodPressure(''); setBloodSugar(''); setPulse(''); setWeight('')
    setShowModal(false)
  }

  function getBloodPressureStatus(bp) {
    if (!bp) return null
    const parts = bp.split('/')
    if (parts.length !== 2) return null
    const sys = parseInt(parts[0])
    if (sys < 90) return { label: 'Düşük', color: '#4CC9F0' }
    if (sys <= 120) return { label: 'Normal', color: COLORS.success }
    if (sys <= 140) return { label: 'Yüksek', color: '#F0A500' }
    return { label: 'Çok Yüksek', color: '#E05050' }
  }

  function getBloodSugarStatus(val) {
    if (!val) return null
    if (val < 70) return { label: 'Düşük', color: '#4CC9F0' }
    if (val <= 100) return { label: 'Normal', color: COLORS.success }
    if (val <= 125) return { label: 'Yüksek', color: '#F0A500' }
    return { label: 'Çok Yüksek', color: '#E05050' }
  }

  function getPulseStatus(val) {
    if (!val) return null
    if (val < 60) return { label: 'Düşük', color: '#4CC9F0' }
    if (val <= 100) return { label: 'Normal', color: COLORS.success }
    return { label: 'Yüksek', color: '#E05050' }
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    })
  }

  const bpStatus    = latest ? getBloodPressureStatus(latest.blood_pressure) : null
  const bsStatus    = latest ? getBloodSugarStatus(latest.blood_sugar) : null
  const pulseStatus = latest ? getPulseStatus(latest.pulse) : null

  const metricItems = latest ? [
    { icon: '🩺', value: latest.blood_pressure || '-', label: 'Tansiyon',   status: bpStatus,
      speech: latest.blood_pressure ? `Tansiyon: ${latest.blood_pressure}. ${bpStatus?.label || ''}` : 'Tansiyon değeri girilmemiş' },
    { icon: '🩸', value: latest.blood_sugar ? `${latest.blood_sugar} mg/dL` : '-', label: 'Kan Şekeri', status: bsStatus,
      speech: latest.blood_sugar ? `Kan şekeri: ${latest.blood_sugar} miligram. ${bsStatus?.label || ''}` : 'Kan şekeri değeri girilmemiş' },
    { icon: '💓', value: latest.pulse ? `${latest.pulse} bpm` : '-', label: 'Nabız', status: pulseStatus,
      speech: latest.pulse ? `Nabız: ${latest.pulse} bpm. ${pulseStatus?.label || ''}` : 'Nabız değeri girilmemiş' },
    { icon: '⚖️', value: latest.weight ? `${latest.weight} kg` : '-', label: 'Kilo', status: null,
      speech: latest.weight ? `Kilo: ${latest.weight} kilogram` : 'Kilo değeri girilmemiş' },
  ] : []

  const latestSpeech = () => {
    if (!latest) return 'Henüz ölçüm kaydedilmemiş.'
    let text = 'Son ölçümler. '
    if (latest.blood_pressure) text += `Tansiyon: ${latest.blood_pressure}. ${bpStatus ? bpStatus.label + '.' : ''} `
    if (latest.blood_sugar)    text += `Kan şekeri: ${latest.blood_sugar} miligram. ${bsStatus ? bsStatus.label + '.' : ''} `
    if (latest.pulse)          text += `Nabız: ${latest.pulse} bpm. ${pulseStatus ? pulseStatus.label + '.' : ''} `
    if (latest.weight)         text += `Kilo: ${latest.weight} kilogram.`
    return text
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* HEADER */}
        <AnimatedCard delay={0}>
          <LinearGradient
            colors={['#4361EE', '#7209B7', '#4CC9F0']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.headerCard}
          >
            <View style={styles.circle1} />
            <View style={styles.circle2} />
            <View style={styles.headerTop}>
              <SpeakablePress text={latestSpeech()} speakOnly style={{ flex: 1 }}>
                <Text style={styles.headerLabel}>Sağlık Takibi</Text>
                <Text style={styles.headerTitle}>📊 Sağlığım</Text>
                <Text style={styles.headerDate}>{records.length} ölçüm kaydedildi</Text>
              </SpeakablePress>
              <View style={{ alignItems: 'flex-end', gap: 8 }}>
                <SpeakablePress text={`${records.length} ölçüm`} speakOnly style={styles.headerBadge}>
                  <Text style={styles.headerBadgeNum}>{records.length}</Text>
                  <Text style={styles.headerBadgeLabel}>Ölçüm</Text>
                </SpeakablePress>
                <SpeechToggleButton />
              </View>
            </View>
          </LinearGradient>
        </AnimatedCard>

        {/* SON ÖLÇÜMLER */}
        <AnimatedCard delay={100}>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <SpeakablePress text={latestSpeech()} speakOnly style={styles.cardHeader}>
              <View style={styles.cardHeaderRow}>
                <View style={[styles.cardIconBox, { backgroundColor: colors.primarySoft }]}>
                  <Text style={{ fontSize: 18 }}>📊</Text>
                </View>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Son Ölçümler</Text>
              </View>
            </SpeakablePress>

            {!latest ? (
              <View style={styles.noData}>
                <Text style={styles.noDataIcon}>📋</Text>
                <Text style={[styles.noDataText, { color: colors.textMuted }]}>Henüz ölçüm eklenmedi</Text>
                <Text style={[styles.noDataSub, { color: colors.border }]}>Aşağıdaki butona basarak ekleyin</Text>
              </View>
            ) : (
              <View style={styles.metricsGrid}>
                {metricItems.map((item, idx) => (
                  <SpeakablePress key={idx} text={item.speech} speakOnly
                    style={[styles.metricCard, { backgroundColor: colors.bg, borderColor: colors.border }]}
                  >
                    <Text style={styles.metricIcon}>{item.icon}</Text>
                    <Text style={[styles.metricValue, { color: colors.text }]}>{item.value}</Text>
                    <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{item.label}</Text>
                    {item.status && (
                      <View style={[styles.statusBadge, { backgroundColor: item.status.color + '25' }]}>
                        <Text style={[styles.statusText, { color: item.status.color }]}>{item.status.label}</Text>
                      </View>
                    )}
                  </SpeakablePress>
                ))}
              </View>
            )}
          </View>
        </AnimatedCard>

        {/* REFERANS DEĞERLERİ */}
        <AnimatedCard delay={200}>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconBox, { backgroundColor: '#E8F4FF' }]}>
                <Text style={{ fontSize: 18 }}>📋</Text>
              </View>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Normal Değerler</Text>
            </View>
            {[
              { icon: '🩺', label: 'Tansiyon', normal: '90/60 – 120/80', iconBg: '#EEF1FF' },
              { icon: '🩸', label: 'Kan Şekeri', normal: '70–100 mg/dL', iconBg: '#F3E8FF' },
              { icon: '💓', label: 'Nabız', normal: '60–100 bpm', iconBg: '#FFE8E8' },
              { icon: '⚖️', label: 'Kilo', normal: 'BMI 18.5–24.9', iconBg: '#E8FFF5' },
            ].map((ref, idx) => (
              <View key={idx} style={[styles.refRow, { borderBottomColor: colors.border }, idx === 3 && { borderBottomWidth: 0 }]}>
                <View style={[styles.refIconBox, { backgroundColor: ref.iconBg }]}>
                  <Text style={{ fontSize: 18 }}>{ref.icon}</Text>
                </View>
                <View style={styles.refInfo}>
                  <Text style={[styles.refLabel, { color: colors.text }]}>{ref.label}</Text>
                  <Text style={[styles.refNormal, { color: colors.textMuted }]}>{ref.normal}</Text>
                </View>
                <View style={[styles.normalBadge, { backgroundColor: COLORS.successSoft }]}>
                  <Text style={[styles.normalBadgeText, { color: COLORS.success }]}>Normal</Text>
                </View>
              </View>
            ))}
          </View>
        </AnimatedCard>

        {/* GEÇMİŞ */}
        {records.length > 0 && (
          <AnimatedCard delay={300}>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconBox, { backgroundColor: '#FFF3E0' }]}>
                  <Text style={{ fontSize: 18 }}>🕐</Text>
                </View>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Ölçüm Geçmişi</Text>
              </View>
              {records.slice(0, 7).map((record, index) => {
                const speechParts = []
                if (record.blood_pressure) speechParts.push(`Tansiyon: ${record.blood_pressure}`)
                if (record.blood_sugar)    speechParts.push(`Kan şekeri: ${record.blood_sugar}`)
                if (record.pulse)          speechParts.push(`Nabız: ${record.pulse}`)
                if (record.weight)         speechParts.push(`Kilo: ${record.weight}`)
                return (
                  <SpeakablePress
                    key={record.id}
                    text={formatDate(record.recorded_at) + '. ' + speechParts.join('. ')}
                    speakOnly
                    style={[
                      styles.historyRow,
                      { borderBottomColor: colors.border },
                      index === 0 && [styles.historyRowLatest, { backgroundColor: colors.primarySoft + '40' }],
                      index === Math.min(records.length, 7) - 1 && { borderBottomWidth: 0 }
                    ]}
                  >
                    <View style={styles.historyLeft}>
                      <Text style={[styles.historyDate, { color: colors.textMuted }]}>{formatDate(record.recorded_at)}</Text>
                      {index === 0 && (
                        <View style={[styles.latestBadge, { backgroundColor: colors.primarySoft }]}>
                          <Text style={[styles.latestBadgeText, { color: colors.primary }]}>Son</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.historyValues}>
                      {record.blood_pressure && <View style={[styles.historyChip, { backgroundColor: colors.bg }]}><Text style={[styles.historyValue, { color: colors.text }]}>🩺 {record.blood_pressure}</Text></View>}
                      {record.blood_sugar    && <View style={[styles.historyChip, { backgroundColor: colors.bg }]}><Text style={[styles.historyValue, { color: colors.text }]}>🩸 {record.blood_sugar}</Text></View>}
                      {record.pulse          && <View style={[styles.historyChip, { backgroundColor: colors.bg }]}><Text style={[styles.historyValue, { color: colors.text }]}>💓 {record.pulse}</Text></View>}
                      {record.weight         && <View style={[styles.historyChip, { backgroundColor: colors.bg }]}><Text style={[styles.historyValue, { color: colors.text }]}>⚖️ {record.weight}kg</Text></View>}
                    </View>
                  </SpeakablePress>
                )
              })}
            </View>
          </AnimatedCard>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <SpeakablePress text="Yeni ölçüm ekle" onPress={() => setShowModal(true)} style={styles.fab} activeOpacity={0.85}>
        <LinearGradient colors={['#4361EE', '#7209B7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fabGradient}>
          <Text style={styles.fabText}>+ Ölçüm Ekle</Text>
        </LinearGradient>
      </SpeakablePress>

      {/* MODAL */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <LinearGradient colors={['#4361EE', '#7209B7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📊 Yeni Ölçüm Ekle</Text>
            </LinearGradient>
            <View style={styles.modalBody}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>🩺 Tansiyon (örn: 120/80)</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="120/80" placeholderTextColor={colors.textMuted} value={bloodPressure} onChangeText={setBloodPressure} keyboardType="numbers-and-punctuation" />
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>🩸 Kan Şekeri (mg/dL)</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="95" placeholderTextColor={colors.textMuted} value={bloodSugar} onChangeText={setBloodSugar} keyboardType="numeric" />
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>💓 Nabız (bpm)</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="72" placeholderTextColor={colors.textMuted} value={pulse} onChangeText={setPulse} keyboardType="numeric" />
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>⚖️ Kilo (kg)</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="68" placeholderTextColor={colors.textMuted} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
              <TouchableOpacity style={styles.btnSave} onPress={handleAddRecord} activeOpacity={0.85}>
                <LinearGradient colors={['#4361EE', '#7209B7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnSaveGradient}>
                  <Text style={styles.btnSaveText}>💾 Kaydet</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setShowModal(false)}>
                <Text style={[styles.btnCancelText, { color: colors.textMuted }]}>İptal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16 },
  headerCard: { borderRadius: RADIUS.lg, padding: 22, marginBottom: 16, overflow: 'hidden', ...SHADOW.lg },
  circle1: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.1)', top: -50, right: -40 },
  circle2: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.08)', bottom: -40, left: 20 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerLabel: { fontSize: FONTS.xs, color: 'rgba(255,255,255,0.75)', fontWeight: '600', marginBottom: 4 },
  headerTitle: { fontSize: FONTS.xl, fontWeight: '900', color: 'white', marginBottom: 4 },
  headerDate: { fontSize: FONTS.xs, color: 'rgba(255,255,255,0.8)' },
  headerBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.md, padding: 12, alignItems: 'center', minWidth: 60 },
  headerBadgeNum: { fontSize: FONTS.xl, fontWeight: '900', color: 'white' },
  headerBadgeLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  card: { borderRadius: RADIUS.lg, padding: 18, marginBottom: 14, ...SHADOW.md },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: FONTS.md, fontWeight: '800', flex: 1 },
  noData: { alignItems: 'center', paddingVertical: 20 },
  noDataIcon: { fontSize: 40, marginBottom: 8 },
  noDataText: { fontSize: FONTS.md, fontWeight: '700' },
  noDataSub: { fontSize: FONTS.xs, marginTop: 4 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '47%', borderRadius: RADIUS.md, padding: 14, alignItems: 'center', borderWidth: 1 },
  metricIcon: { fontSize: 28, marginBottom: 6 },
  metricValue: { fontSize: FONTS.md, fontWeight: '900', textAlign: 'center' },
  metricLabel: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  statusText: { fontSize: 11, fontWeight: '800' },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  refIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  refInfo: { flex: 1 },
  refLabel: { fontSize: FONTS.sm, fontWeight: '800' },
  refNormal: { fontSize: FONTS.xs, marginTop: 2 },
  normalBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  normalBadgeText: { fontSize: 11, fontWeight: '800' },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
  historyRowLatest: { borderRadius: 10, paddingHorizontal: 8 },
  historyLeft: { minWidth: 90 },
  historyDate: { fontSize: 11, fontWeight: '700' },
  latestBadge: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginTop: 3 },
  latestBadgeText: { fontSize: 10, fontWeight: '800' },
  historyValues: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  historyChip: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  historyValue: { fontSize: 12, fontWeight: '700' },
  fab: { position: 'absolute', bottom: 24, right: 24, borderRadius: 30, overflow: 'hidden', ...SHADOW.lg },
  fabGradient: { paddingHorizontal: 24, paddingVertical: 14 },
  fabText: { color: 'white', fontSize: FONTS.sm, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
  modalHeader: { padding: 20, alignItems: 'center' },
  modalTitle: { fontSize: FONTS.lg, fontWeight: '800', color: 'white' },
  modalBody: { padding: 24, paddingBottom: 40 },
  inputLabel: { fontSize: FONTS.xs, fontWeight: '700', marginBottom: 6 },
  input: { borderRadius: RADIUS.md, padding: 14, fontSize: FONTS.sm, marginBottom: 12, borderWidth: 2 },
  btnSave: { borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: 10 },
  btnSaveGradient: { padding: 16, alignItems: 'center' },
  btnSaveText: { color: 'white', fontSize: FONTS.md, fontWeight: '800' },
  btnCancel: { alignItems: 'center', padding: 10 },
  btnCancelText: { fontSize: FONTS.sm, fontWeight: '700' },
})