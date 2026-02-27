import { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, Modal, Animated } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Calendar } from 'react-native-calendars'
import { COLORS, FONTS, RADIUS, SHADOW } from '../lib/theme'
import { useTheme } from '../lib/ThemeContext'
import { SpeakablePress, SpeechToggleButton, useSpeech } from '../lib/SpeechContext'
import { usePlans } from '../lib/useData'

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

export default function PlanningScreen() {
  const [showModal, setShowModal]     = useState(false)
  const [title, setTitle]             = useState('')
  const [planTime, setPlanTime]       = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const { speak } = useSpeech()
  const { colors } = useTheme()

  // ── Hook ─────────────────────────────────────────────────────────
  const { plans, allDates, loading, addPlan, deletePlan, toggleDone } = usePlans(selectedDate)

  // Seçili tarihi takvimde göster
  const markedDates = {
    ...allDates,
    [selectedDate]: {
      ...(allDates[selectedDate] || {}),
      selected: true,
      selectedColor: COLORS.primary,
    }
  }

  function onDayPress(day) {
    setSelectedDate(day.dateString)
  }

  async function handleAddPlan() {
    if (!title.trim()) { Alert.alert('Hata', 'Plan başlığı giriniz'); return }
    const result = await addPlan({
      title: title.trim(),
      plan_time: planTime || null,
      plan_date: selectedDate,
    })
    if (!result.success) { Alert.alert('Hata', result.error); return }
    setTitle(''); setPlanTime('')
    setShowModal(false)
  }

  async function handleToggleDone(plan) {
    speak(plan.title + (plan.is_done ? ' yapılacaklara alındı' : ' tamamlandı'))
    await toggleDone(plan)
  }

  async function handleDeletePlan(id, title) {
    Alert.alert('Sil', 'Bu planı silmek istiyor musunuz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => deletePlan(id) }
    ])
  }

  const donePlans  = plans.filter(p => p.is_done)
  const todoplans  = plans.filter(p => !p.is_done)
  const progress   = plans.length > 0 ? Math.round((donePlans.length / plans.length) * 100) : 0

  const selectedDateFormatted = new Date(selectedDate + 'T00:00:00')
    .toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })

  function planSpeech(plan) {
    return `${plan.is_done ? 'Tamamlandı' : 'Yapılacak'}: ${plan.title}. ${plan.plan_time ? 'Saat ' + plan.plan_time.slice(0, 5) : ''}`
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
              <SpeakablePress
                text={`Planlarım. ${selectedDateFormatted}. ${plans.length} plan var. Yüzde ${progress} tamamlandı.`}
                speakOnly style={{ flex: 1 }}
              >
                <Text style={styles.headerLabel}>Planlama</Text>
                <Text style={styles.headerTitle}>📅 Planlarım</Text>
                <Text style={styles.headerSub}>{selectedDateFormatted}</Text>
              </SpeakablePress>
              <View style={{ alignItems: 'flex-end', gap: 8 }}>
                {plans.length > 0 && (
                  <SpeakablePress text={`Yüzde ${progress} tamamlandı`} speakOnly style={styles.progressBox}>
                    <Text style={styles.progressNum}>{progress}%</Text>
                    <Text style={styles.progressLabel}>Tamamlandı</Text>
                  </SpeakablePress>
                )}
                <SpeechToggleButton />
              </View>
            </View>

            {plans.length > 0 && (
              <View style={styles.progressSection}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
              </View>
            )}
          </LinearGradient>
        </AnimatedCard>

        {/* TAKVİM */}
        <AnimatedCard delay={100}>
          <View style={[styles.calendarCard, { backgroundColor: colors.card }]}>
            <Calendar
              current={selectedDate}
              onDayPress={onDayPress}
              markingType="multi-dot"
              markedDates={markedDates}
              theme={{
                backgroundColor: colors.card,
                calendarBackground: colors.card,
                selectedDayBackgroundColor: COLORS.primary,
                todayTextColor: COLORS.primary,
                arrowColor: COLORS.primary,
                monthTextColor: colors.text,
                dayTextColor: colors.text,
                textDisabledColor: colors.border,
              }}
            />
          </View>
        </AnimatedCard>

        {/* SEÇİLİ GÜN BAŞLIĞI */}
        <AnimatedCard delay={150}>
          <View style={styles.dayHeader}>
            <View>
              <Text style={[styles.dayTitle, { color: colors.text }]}>{selectedDateFormatted}</Text>
              <Text style={[styles.daySub, { color: colors.textMuted }]}>{plans.length} plan</Text>
            </View>
            <SpeakablePress text="Yeni plan ekle" onPress={() => setShowModal(true)} activeOpacity={0.85}>
              <LinearGradient colors={[COLORS.primary, '#7209B7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addBtn}>
                <Text style={styles.addBtnText}>+ Ekle</Text>
              </LinearGradient>
            </SpeakablePress>
          </View>
        </AnimatedCard>

        {/* YAPILACAKLAR */}
        {todoplans.length > 0 && (
          <>
            <AnimatedCard delay={200}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconBox, { backgroundColor: colors.primarySoft }]}>
                  <Text style={{ fontSize: 14 }}>⭕</Text>
                </View>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Yapılacaklar</Text>
                <View style={[styles.countBadge, { backgroundColor: colors.primarySoft }]}>
                  <Text style={[styles.countBadgeText, { color: colors.primary }]}>{todoplans.length}</Text>
                </View>
              </View>
            </AnimatedCard>
            {todoplans.map((plan, index) => (
              <AnimatedCard key={plan.id} delay={220 + index * 50}>
                <SpeakablePress text={planSpeech(plan)} speakOnly style={[styles.planCard, { backgroundColor: colors.card }]}>
                  <SpeakablePress text={plan.title + ' tamamlandı olarak işaretle'} onPress={() => handleToggleDone(plan)}>
                    <View style={[styles.circle, { borderColor: colors.primary }]} />
                  </SpeakablePress>
                  <View style={styles.planInfo}>
                    <Text style={[styles.planTitle, { color: colors.text }]}>{plan.title}</Text>
                    {plan.plan_time && <Text style={[styles.planTime, { color: colors.textMuted }]}>🕐 {plan.plan_time.slice(0, 5)}</Text>}
                  </View>
                  <SpeakablePress text={plan.title + ' siliniyor'} onPress={() => handleDeletePlan(plan.id, plan.title)} style={styles.deleteBtn}>
                    <Text style={styles.deleteIcon}>🗑️</Text>
                  </SpeakablePress>
                </SpeakablePress>
              </AnimatedCard>
            ))}
          </>
        )}

        {/* TAMAMLANANLAR */}
        {donePlans.length > 0 && (
          <>
            <AnimatedCard delay={400}>
              <View style={[styles.sectionHeader, { marginTop: 8 }]}>
                <View style={[styles.sectionIconBox, { backgroundColor: COLORS.successSoft }]}>
                  <Text style={{ fontSize: 14 }}>✅</Text>
                </View>
                <Text style={[styles.sectionTitle, { color: COLORS.success }]}>Tamamlananlar</Text>
                <View style={[styles.countBadge, { backgroundColor: COLORS.successSoft }]}>
                  <Text style={[styles.countBadgeText, { color: COLORS.success }]}>{donePlans.length}</Text>
                </View>
              </View>
            </AnimatedCard>
            {donePlans.map((plan, index) => (
              <AnimatedCard key={plan.id} delay={420 + index * 50}>
                <SpeakablePress text={planSpeech(plan)} speakOnly style={[styles.planCard, styles.planDone]}>
                  <SpeakablePress text={plan.title + ' yapılacaklara geri alındı'} onPress={() => handleToggleDone(plan)}>
                    <Text style={{ fontSize: 24 }}>✅</Text>
                  </SpeakablePress>
                  <View style={styles.planInfo}>
                    <Text style={[styles.planTitle, styles.planTitleDone]}>{plan.title}</Text>
                    {plan.plan_time && <Text style={styles.planTime}>🕐 {plan.plan_time.slice(0, 5)}</Text>}
                  </View>
                  <SpeakablePress text={plan.title + ' siliniyor'} onPress={() => handleDeletePlan(plan.id, plan.title)} style={styles.deleteBtn}>
                    <Text style={styles.deleteIcon}>🗑️</Text>
                  </SpeakablePress>
                </SpeakablePress>
              </AnimatedCard>
            ))}
          </>
        )}

        {/* BOŞ DURUM */}
        {plans.length === 0 && !loading && (
          <AnimatedCard delay={200}>
            <View style={styles.empty}>
              <LinearGradient colors={[COLORS.primarySoft, '#EEF2FF']} style={styles.emptyIconBox}>
                <Text style={styles.emptyIcon}>📋</Text>
              </LinearGradient>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>Bu gün için plan yok</Text>
              <SpeakablePress text="Yeni plan ekle" onPress={() => setShowModal(true)} activeOpacity={0.85}>
                <LinearGradient colors={[COLORS.primary, '#7209B7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.emptyAddBtn}>
                  <Text style={styles.emptyAddBtnText}>+ Plan Ekle</Text>
                </LinearGradient>
              </SpeakablePress>
            </View>
          </AnimatedCard>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* MODAL */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <LinearGradient colors={['#4361EE', '#7209B7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📅 Plan Ekle</Text>
              <Text style={styles.modalDate}>📌 {selectedDateFormatted}</Text>
            </LinearGradient>
            <View style={styles.modalBody}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                placeholder="Ne yapılacak? *" placeholderTextColor={colors.textMuted}
                value={title} onChangeText={setTitle}
              />
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                placeholder="Saat (örn: 14:00)" placeholderTextColor={colors.textMuted}
                value={planTime} onChangeText={setPlanTime} keyboardType="numbers-and-punctuation"
              />
              <TouchableOpacity style={styles.btnSave} onPress={handleAddPlan} activeOpacity={0.85}>
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
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  headerLabel: { fontSize: FONTS.xs, color: 'rgba(255,255,255,0.75)', fontWeight: '600', marginBottom: 4 },
  headerTitle: { fontSize: FONTS.xl, fontWeight: '900', color: 'white', marginBottom: 4 },
  headerSub: { fontSize: FONTS.xs, color: 'rgba(255,255,255,0.8)' },
  progressBox: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.md, padding: 12, alignItems: 'center', minWidth: 70 },
  progressNum: { fontSize: FONTS.xl, fontWeight: '900', color: 'white' },
  progressLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  progressSection: { marginTop: 4 },
  progressTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 3 },
  progressFill: { height: 6, backgroundColor: 'white', borderRadius: 3 },
  calendarCard: { borderRadius: RADIUS.lg, padding: 10, marginBottom: 16, ...SHADOW.md },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  dayTitle: { fontSize: FONTS.md, fontWeight: '800' },
  daySub: { fontSize: FONTS.xs, marginTop: 2 },
  addBtn: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: 'white', fontWeight: '800', fontSize: FONTS.xs },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionIconBox: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: FONTS.xs, fontWeight: '800', flex: 1 },
  countBadge: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  countBadgeText: { fontSize: 11, fontWeight: '800' },
  planCard: { borderRadius: RADIUS.md, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12, ...SHADOW.sm },
  planDone: { backgroundColor: COLORS.successSoft + '60', opacity: 0.85 },
  circle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2.5 },
  planInfo: { flex: 1 },
  planTitle: { fontSize: FONTS.sm, fontWeight: '700' },
  planTitleDone: { textDecorationLine: 'line-through', color: COLORS.textMuted },
  planTime: { fontSize: FONTS.xs, color: COLORS.textMuted, marginTop: 3 },
  deleteBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFE8E8', alignItems: 'center', justifyContent: 'center' },
  deleteIcon: { fontSize: 14 },
  empty: { alignItems: 'center', paddingTop: 30, paddingBottom: 20 },
  emptyIconBox: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyIcon: { fontSize: 44 },
  emptyText: { fontSize: FONTS.md, fontWeight: '700', marginBottom: 16 },
  emptyAddBtn: { borderRadius: 20, paddingHorizontal: 24, paddingVertical: 12 },
  emptyAddBtnText: { color: 'white', fontWeight: '800', fontSize: FONTS.sm },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
  modalHeader: { padding: 20, alignItems: 'center' },
  modalTitle: { fontSize: FONTS.lg, fontWeight: '800', color: 'white', marginBottom: 2 },
  modalDate: { fontSize: FONTS.xs, color: 'rgba(255,255,255,0.8)', fontWeight: '700' },
  modalBody: { padding: 24, paddingBottom: 40 },
  input: { borderRadius: RADIUS.md, padding: 14, fontSize: FONTS.sm, marginBottom: 10, borderWidth: 2 },
  btnSave: { borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: 10 },
  btnSaveGradient: { padding: 16, alignItems: 'center' },
  btnSaveText: { color: 'white', fontSize: FONTS.md, fontWeight: '800' },
  btnCancel: { alignItems: 'center', padding: 10 },
  btnCancelText: { fontSize: FONTS.sm, fontWeight: '700' },
})