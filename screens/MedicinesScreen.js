import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, Alert, Modal, Animated
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '../lib/supabase'
import { COLORS, FONTS, RADIUS, SHADOW } from '../lib/theme'
import { useTheme } from '../lib/ThemeContext'
import VoiceMedicineAdd from './VoiceMedicineAdd'
import { scheduleMedicineNotifications, cancelMedicineNotifications } from '../lib/notifications'
import { SpeakablePress, SpeechToggleButton, useSpeech } from '../lib/SpeechContext'
import { markMedicineTaken, unmarkMedicineTaken, fetchTakenIdsForToday } from '../lib/medicineService'

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const TODAY = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]
const MED_COLORS = ['#E07B4F', '#4A9B8E', '#6B5B8E', '#F0A500', '#E05050']
const ICONS = ['💊', '🔵', '🟡', '🟢', '❤️']

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

export default function MedicinesScreen() {
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showVoice, setShowVoice] = useState(false)
  const [takenIds, setTakenIds] = useState([])
  const [userId, setUserId] = useState(null)
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [selectedDays, setSelectedDays] = useState([])
  const [times, setTimes] = useState('')
  const [note, setNote] = useState('')
  const { speak } = useSpeech()
  const { colors } = useTheme()

  useEffect(() => { fetchMedicines() }, [])

  async function fetchMedicines() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const [medsRes, takenRes] = await Promise.all([
      supabase.from('medicines').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      fetchTakenIdsForToday(user.id),
    ])

    if (!medsRes.error) setMedicines(medsRes.data || [])
    setTakenIds(takenRes)
    setLoading(false)
  }

  async function addMedicine() {
    if (!name.trim()) { Alert.alert('Hata', 'İlaç adı giriniz'); return }
    if (!selectedDays.length) { Alert.alert('Hata', 'En az bir gün seçiniz'); return }
    const { data: { user } } = await supabase.auth.getUser()
    const idx = medicines.length % MED_COLORS.length
    const { data: savedMed, error } = await supabase.from('medicines').insert({
      user_id: user.id, name: name.trim(), dose: dose.trim(),
      days: selectedDays, times: times ? times.split(',').map(t => t.trim()) : ['08:00'],
      note: note.trim(), color: MED_COLORS[idx], icon: ICONS[idx],
    }).select().single()
    if (error) { Alert.alert('Hata', error.message); return }
    await scheduleMedicineNotifications(savedMed)
    setName(''); setDose(''); setSelectedDays([]); setTimes(''); setNote('')
    setShowModal(false)
    fetchMedicines()
  }

  async function deleteMedicine(id) {
    Alert.alert('Sil', 'Bu ilacı silmek istediğinizden emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
        const med = medicines.find(m => m.id === id)
        if (med) await cancelMedicineNotifications(id, med.days || [], med.times || [])
        await supabase.from('medicines').delete().eq('id', id)
        fetchMedicines()
      }}
    ])
  }

  // ✅ Düzeltildi: DB'ye yazıyor, optimistic update ile
  async function markTaken(med) {
    if (!userId) return
    const isTaken = takenIds.includes(med.id)

    // Optimistic UI
    if (isTaken) {
      setTakenIds(prev => prev.filter(id => id !== med.id))
    } else {
      setTakenIds(prev => [...prev, med.id])
      speak(med.name + ' alındı olarak işaretlendi')
    }

    // DB işlemi
    const result = isTaken
      ? await unmarkMedicineTaken(userId, med.id)
      : await markMedicineTaken(userId, med.id)

    // Hata olursa geri al
    if (!result.success) {
      if (isTaken) {
        setTakenIds(prev => [...prev, med.id])
      } else {
        setTakenIds(prev => prev.filter(id => id !== med.id))
      }
      Alert.alert('Hata', 'İşaretleme kaydedilemedi.')
    }
  }

  function toggleDay(day) {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  function buildMedSpeech(med) {
    let t = med.name + '. '
    if (med.dose) t += 'Doz: ' + med.dose + '. '
    if (med.note) t += med.note + '. '
    t += 'Günler: ' + (med.days || []).join(', ') + '. '
    t += 'Saatler: ' + (med.times || []).join(', ')
    return t
  }

  const todayMeds = medicines.filter(m => m.days?.includes(TODAY))
  const takenToday = todayMeds.filter(m => takenIds.includes(m.id)).length

  if (loading) return (
    <LinearGradient colors={['#4361EE', '#7209B7']} style={styles.loadingScreen}>
      <Text style={styles.loadingText}>💊 İlaçlar yükleniyor...</Text>
    </LinearGradient>
  )

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
              <SpeakablePress
                text={`İlaç takibi. Toplam ${medicines.length} ilaç kayıtlı. Bugün ${todayMeds.length} ilaç var, ${takenToday} tanesi alındı.`}
                speakOnly
                style={{ flex: 1 }}
              >
                <Text style={styles.headerLabel}>İlaç Takibi</Text>
                <Text style={styles.headerTitle}>💊 İlaçlarım</Text>
                <Text style={styles.headerSub}>{medicines.length} ilaç kayıtlı</Text>
              </SpeakablePress>
              <View style={{ alignItems: 'flex-end', gap: 8 }}>
                <View style={styles.headerStats}>
                  <SpeakablePress text={`Bugün ${todayMeds.length} ilaç`} speakOnly style={styles.statBox}>
                    <Text style={styles.statNum}>{todayMeds.length}</Text>
                    <Text style={styles.statLabel}>Bugün</Text>
                  </SpeakablePress>
                  <SpeakablePress text={`${takenToday} ilaç alındı`} speakOnly style={[styles.statBox, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                    <Text style={styles.statNum}>{takenToday}</Text>
                    <Text style={styles.statLabel}>Alındı</Text>
                  </SpeakablePress>
                </View>
                <SpeechToggleButton />
              </View>
            </View>
          </LinearGradient>
        </AnimatedCard>

        {/* İLAÇ LİSTESİ */}
        {medicines.length === 0 ? (
          <View style={styles.empty}>
            <LinearGradient colors={['#EEF1FF', '#E8F4FF']} style={styles.emptyIconBox}>
              <Text style={styles.emptyIcon}>💊</Text>
            </LinearGradient>
            <Text style={[styles.emptyText, { color: colors.text }]}>Henüz ilaç eklenmedi</Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>Aşağıdaki butonları kullanarak ilaç ekleyin</Text>
          </View>
        ) : medicines.map((med, index) => {
          const isTaken = takenIds.includes(med.id)
          const isToday = med.days?.includes(TODAY)
          return (
            <AnimatedCard key={med.id} delay={index * 60}>
              <View style={[styles.card, { backgroundColor: colors.card, borderLeftColor: med.color || '#4361EE' }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.medIconBox, { backgroundColor: (med.color || '#4361EE') + '22' }]}>
                    <Text style={styles.medIcon}>{med.icon || '💊'}</Text>
                  </View>
                  <View style={styles.medInfo}>
                    <Text style={[styles.medName, { color: colors.text }]}>{med.name}</Text>
                    {med.dose ? <Text style={[styles.medDose, { color: colors.textMuted }]}>{med.dose}</Text> : null}
                    {med.note ? <Text style={[styles.medNote, { color: colors.textMuted }]}>{med.note}</Text> : null}
                  </View>
                  {isToday && (
                    <LinearGradient
                      colors={isTaken ? ['#06D6A0', '#4CC9F0'] : ['#4361EE', '#7209B7']}
                      style={styles.todayBadge}
                    >
                      <Text style={styles.todayText}>{isTaken ? '✅ Alındı' : '📅 Bugün'}</Text>
                    </LinearGradient>
                  )}
                </View>

                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Günler</Text>
                <View style={styles.daysRow}>
                  {(med.days || []).map(d => (
                    <View key={d} style={[styles.dayChip, { backgroundColor: d === TODAY ? (med.color || '#4361EE') + '22' : colors.border }]}>
                      <Text style={[styles.dayChipText, { color: d === TODAY ? (med.color || '#4361EE') : colors.textMuted, fontWeight: d === TODAY ? '900' : '700' }]}>{d}</Text>
                    </View>
                  ))}
                </View>

                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Saatler</Text>
                <View style={styles.timesRow}>
                  {(med.times || []).map(t => (
                    <View key={t} style={[styles.timeChip, { backgroundColor: (med.color || '#4361EE') + '15' }]}>
                      <Text style={[styles.timeChipText, { color: med.color || '#4361EE' }]}>⏰ {t}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.cardActions}>
                  <SpeakablePress
                    text={isTaken ? med.name + ' alındı işareti kaldırılıyor' : med.name + ' alındı olarak işaretleniyor'}
                    onPress={() => markTaken(med)}
                    style={[styles.btnTaken, { backgroundColor: isTaken ? '#E8FBF5' : colors.bg }]}
                    activeOpacity={0.8}
                  >
                    {isTaken ? (
                      <LinearGradient colors={[COLORS.success, '#06D6A0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnTakenGradient}>
                        <Text style={styles.btnTakenTextActive}>✅ Alındı</Text>
                      </LinearGradient>
                    ) : (
                      <Text style={[styles.btnTakenText, { color: colors.text }]}>✓ Alındı İşaretle</Text>
                    )}
                  </SpeakablePress>
                  <SpeakablePress
                    text={med.name + ' siliniyor'}
                    onPress={() => deleteMedicine(med.id)}
                    style={styles.btnDelete}
                  >
                    <Text style={styles.btnDeleteText}>🗑️</Text>
                  </SpeakablePress>
                </View>
              </View>
            </AnimatedCard>
          )
        })}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* FAB BUTONLAR */}
      <View style={styles.fabRow}>
        <SpeakablePress text="Sesli ilaç ekleme" onPress={() => setShowVoice(true)} style={styles.fabVoice} activeOpacity={0.85}>
          <LinearGradient colors={['#7209B7', '#4361EE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fabGradient}>
            <Text style={styles.fabText}>🎙️ Sesli Ekle</Text>
          </LinearGradient>
        </SpeakablePress>
        <SpeakablePress text="Manuel ilaç ekleme" onPress={() => setShowModal(true)} style={styles.fab} activeOpacity={0.85}>
          <LinearGradient colors={['#4361EE', '#4CC9F0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fabGradient}>
            <Text style={styles.fabText}>✏️ Manuel</Text>
          </LinearGradient>
        </SpeakablePress>
      </View>

      <VoiceMedicineAdd
        visible={showVoice}
        onClose={() => setShowVoice(false)}
        onSaved={() => { setShowVoice(false); fetchMedicines() }}
      />

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <LinearGradient colors={['#4361EE', '#7209B7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.modalHeader}>
              <Text style={styles.modalTitle}>💊 Yeni İlaç Ekle</Text>
            </LinearGradient>
            <View style={styles.modalBody}>
              <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="İlaç adı *" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} />
              <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="Doz (örn: 500mg)" placeholderTextColor={colors.textMuted} value={dose} onChangeText={setDose} />
              <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="Saatler (örn: 08:00, 20:00)" placeholderTextColor={colors.textMuted} value={times} onChangeText={setTimes} />
              <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholder="Not (örn: Diyabet için)" placeholderTextColor={colors.textMuted} value={note} onChangeText={setNote} />
              <Text style={[styles.formLabel, { color: colors.textMuted }]}>Hangi günler?</Text>
              <View style={styles.dayPicker}>
                {DAYS.map(d => (
                  <TouchableOpacity key={d} style={[styles.dayPickBtn, { borderColor: colors.border }, selectedDays.includes(d) && styles.dayPickBtnActive]} onPress={() => toggleDay(d)}>
                    <Text style={[styles.dayPickText, { color: colors.textMuted }, selectedDays.includes(d) && styles.dayPickTextActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.btnSave} onPress={addMedicine} activeOpacity={0.85}>
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
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: FONTS.md, color: 'white', fontWeight: '700' },
  headerCard: { borderRadius: RADIUS.lg, padding: 22, marginBottom: 16, overflow: 'hidden', ...SHADOW.lg },
  circle1: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.1)', top: -50, right: -40 },
  circle2: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.08)', bottom: -40, left: 20 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start' },
  headerLabel: { fontSize: FONTS.xs, color: 'rgba(255,255,255,0.75)', fontWeight: '600', marginBottom: 4 },
  headerTitle: { fontSize: FONTS.xl, fontWeight: '900', color: 'white', marginBottom: 4 },
  headerSub: { fontSize: FONTS.xs, color: 'rgba(255,255,255,0.8)' },
  headerStats: { flexDirection: 'row', gap: 8 },
  statBox: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.md, padding: 10, alignItems: 'center', minWidth: 52 },
  statNum: { fontSize: FONTS.lg, fontWeight: '900', color: 'white' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  empty: { alignItems: 'center', paddingTop: 60, paddingBottom: 20 },
  emptyIconBox: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: FONTS.lg, fontWeight: '800', marginBottom: 8 },
  emptySub: { fontSize: FONTS.sm },
  card: { borderRadius: RADIUS.lg, padding: 16, marginBottom: 14, borderLeftWidth: 4, ...SHADOW.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  medIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  medIcon: { fontSize: 24 },
  medInfo: { flex: 1 },
  medName: { fontSize: FONTS.md, fontWeight: '800' },
  medDose: { fontSize: FONTS.xs, marginTop: 1 },
  medNote: { fontSize: FONTS.xs, marginTop: 1 },
  todayBadge: { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 5 },
  todayText: { fontSize: 11, fontWeight: '800', color: 'white' },
  sectionLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  daysRow: { flexDirection: 'row', gap: 4, marginBottom: 10, flexWrap: 'wrap' },
  dayChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  dayChipText: { fontSize: 11, fontWeight: '700' },
  timesRow: { flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' },
  timeChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  timeChipText: { fontSize: 12, fontWeight: '700' },
  cardActions: { flexDirection: 'row', gap: 8 },
  btnTaken: { flex: 1, borderRadius: RADIUS.sm, overflow: 'hidden' },
  btnTakenGradient: { padding: 10, alignItems: 'center' },
  btnTakenText: { fontSize: FONTS.sm, fontWeight: '800', textAlign: 'center', paddingVertical: 10 },
  btnTakenTextActive: { fontSize: FONTS.sm, fontWeight: '800', color: 'white' },
  btnDelete: { backgroundColor: '#FFE8E8', borderRadius: RADIUS.sm, padding: 10, paddingHorizontal: 14, justifyContent: 'center' },
  btnDeleteText: { fontSize: 16 },
  fabRow: { position: 'absolute', bottom: 24, left: 16, right: 16, flexDirection: 'row', gap: 10 },
  fab: { flex: 1, borderRadius: 30, overflow: 'hidden', ...SHADOW.lg },
  fabVoice: { flex: 1, borderRadius: 30, overflow: 'hidden', ...SHADOW.lg },
  fabGradient: { paddingVertical: 14, alignItems: 'center' },
  fabText: { color: 'white', fontSize: FONTS.sm, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
  modalHeader: { padding: 20, alignItems: 'center' },
  modalTitle: { fontSize: FONTS.lg, fontWeight: '800', color: 'white' },
  modalBody: { padding: 24, paddingBottom: 40 },
  input: { borderRadius: RADIUS.md, padding: 14, fontSize: FONTS.sm, marginBottom: 10, borderWidth: 2 },
  formLabel: { fontSize: FONTS.xs, fontWeight: '700', marginBottom: 8 },
  dayPicker: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 16 },
  dayPickBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 2 },
  dayPickBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayPickText: { fontSize: 12, fontWeight: '700' },
  dayPickTextActive: { color: 'white' },
  btnSave: { borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: 10 },
  btnSaveGradient: { padding: 16, alignItems: 'center' },
  btnSaveText: { color: 'white', fontSize: FONTS.md, fontWeight: '800' },
  btnCancel: { alignItems: 'center', padding: 10 },
  btnCancelText: { fontSize: FONTS.sm, fontWeight: '700' },
})