import { useState, useEffect, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, Animated
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '../lib/supabase'
import { FONTS, RADIUS, SHADOW } from '../lib/theme'
import { useTheme } from '../lib/ThemeContext'
import { SpeakablePress, SpeechToggleButton, useSpeech } from '../lib/SpeechContext'
import { ThemeToggleButton } from '../lib/ThemeContext'

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const TODAY = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]

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

export default function HomeScreen({ navigation }) {
  const [profile, setProfile] = useState(null)
  const [medicines, setMedicines] = useState([])
  const [plans, setPlans] = useState([])
  const [takenIds, setTakenIds] = useState([])      // local için
  const [takenRecords, setTakenRecords] = useState([]) // DB'den gelen
  const [refreshing, setRefreshing] = useState(false)
  const [currentTime, setCurrentTime] = useState('')
  const [greeting, setGreeting] = useState('')
  const { speak } = useSpeech()
  const { colors } = useTheme()
  const todayStr = new Date().toISOString().split('T')[0]

  useEffect(() => {
    fetchData()
    updateTime()
    const interval = setInterval(updateTime, 60000)
    return () => clearInterval(interval)
  }, [])

  function updateTime() {
    const now = new Date()
    const h = now.getHours()
    const m = String(now.getMinutes()).padStart(2, '0')
    setCurrentTime(`${h}:${m}`)
    if (h < 12) setGreeting('Günaydın ☀️')
    else if (h < 18) setGreeting('İyi Günler 🌤️')
    else setGreeting('İyi Akşamlar 🌙')
  }

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [profRes, medsRes, plansRes, takenRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('medicines').select('*').eq('user_id', user.id),
      supabase.from('plans').select('*')
        .eq('user_id', user.id).eq('plan_date', todayStr)
        .order('plan_time', { ascending: true }),
      // Bugün alınan ilaçları çek
      supabase.from('medicine_taken_logs')
        .select('medicine_id')
        .eq('user_id', user.id)
        .eq('taken_date', todayStr),
    ])

    if (profRes.data) setProfile(profRes.data)
    setMedicines((medsRes.data || []).filter(m => m.days?.includes(TODAY)))
    setPlans(plansRes.data || [])

    // DB'den gelen alındı kayıtları
    const dbTakenIds = (takenRes.data || []).map(r => r.medicine_id)
    setTakenRecords(dbTakenIds)
    setTakenIds(dbTakenIds) // local state'i de güncelle
  }

  async function onRefresh() {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  async function markTaken(med) {
    if (takenIds.includes(med.id)) return

    // Optimistic UI update
    setTakenIds(prev => [...prev, med.id])
    speak(med.name + ' ilacı alındı olarak işaretlendi')

    // Supabase'e kaydet
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('medicine_taken_logs').upsert({
      user_id: user.id,
      medicine_id: med.id,
      taken_date: todayStr,
      taken_at: new Date().toISOString(),
    }, { onConflict: 'user_id,medicine_id,taken_date' })

    if (error) {
      console.error('markTaken error:', error)
      // Hata varsa geri al
      setTakenIds(prev => prev.filter(id => id !== med.id))
    }
  }

  const donePlans = plans.filter(p => p.is_done)
  const progress = plans.length > 0
    ? Math.round((donePlans.length / plans.length) * 100) : 0

  const todayDisplayStr = new Date().toLocaleDateString('tr-TR', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  const userName = profile?.full_name?.split(' ')[0] || 'Hoş geldiniz'

  const motivationText = progress === 100
    ? 'Harika! Tüm planlarını tamamladın!'
    : progress >= 50
    ? 'Çok iyi gidiyorsun, devam et!'
    : 'Güzel bir gün seni bekliyor!'

  const s = makeStyles(colors)

  return (
    <ScrollView
      style={[s.container]}
      contentContainerStyle={s.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
          colors={[colors.primary]} tintColor={colors.primary} />
      }
    >
      {/* HEADER */}
      <AnimatedCard delay={0}>
        <LinearGradient
          colors={['#4361EE', '#7209B7', '#4CC9F0']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={s.headerCard}
        >
          <View style={s.circle1} />
          <View style={s.circle2} />

          <View style={s.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={s.greetingText}>{greeting}</Text>

              {/* FIX: 'Profil' tab adı ile eşleşen navigate */}
              <SpeakablePress
                text={`Profil sayfasına git. Merhaba ${userName}`}
                onPress={() => navigation.navigate('Profil')}
                style={s.userNameRow}
              >
                <Text style={s.userName} numberOfLines={1}>
                  {userName.charAt(0).toUpperCase() + userName.slice(1)}
                </Text>
                <Text style={s.userNameArrow}>›</Text>
              </SpeakablePress>

              <Text style={s.dateText}>{todayDisplayStr}</Text>
            </View>

            <View style={{ alignItems: 'flex-end', gap: 8 }}>
              <SpeakablePress text={`Şu an saat ${currentTime}`} speakOnly style={s.clockBox}>
                <Text style={s.clockText}>{currentTime}</Text>
                <Text style={s.clockLabel}>Şu an</Text>
              </SpeakablePress>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <SpeechToggleButton />
                <ThemeToggleButton />
              </View>
            </View>
          </View>

          {plans.length > 0 && (
            <SpeakablePress
              text={`Günlük ilerleme: Yüzde ${progress}. ${donePlans.length} plan tamamlandı.`}
              speakOnly
              style={s.progressSection}
            >
              <View style={s.progressHeader}>
                <Text style={s.progressLabel}>Günlük İlerleme</Text>
                <Text style={s.progressPercent}>{progress}%</Text>
              </View>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={s.progressSub}>{donePlans.length}/{plans.length} tamamlandı</Text>
            </SpeakablePress>
          )}
        </LinearGradient>
      </AnimatedCard>

      {/* ÖZET KARTLARI */}
      <AnimatedCard delay={100}>
        <View style={s.summaryRow}>
          <SpeakablePress text={`Bugün ${medicines.length} ilaç var`} speakOnly
            style={[s.summaryCard, { backgroundColor: colors.primarySoft }]}>
            <Text style={s.summaryEmoji}>💊</Text>
            <Text style={[s.summaryNum, { color: colors.primary }]}>{medicines.length}</Text>
            <Text style={[s.summaryLabel, { color: colors.textMuted }]}>Bugün{'\n'}İlaç</Text>
          </SpeakablePress>

          <SpeakablePress text={`${takenIds.length} ilaç alındı`} speakOnly
            style={[s.summaryCard, { backgroundColor: colors.successSoft }]}>
            <Text style={s.summaryEmoji}>✅</Text>
            <Text style={[s.summaryNum, { color: colors.success }]}>{takenIds.length}</Text>
            <Text style={[s.summaryLabel, { color: colors.textMuted }]}>İlaç{'\n'}Alındı</Text>
          </SpeakablePress>

          <SpeakablePress text={`${plans.length - donePlans.length} plan kaldı`} speakOnly
            style={[s.summaryCard, { backgroundColor: colors.accentSoft }]}>
            <Text style={s.summaryEmoji}>📋</Text>
            <Text style={[s.summaryNum, { color: colors.accent }]}>
              {plans.length - donePlans.length}
            </Text>
            <Text style={[s.summaryLabel, { color: colors.textMuted }]}>Kalan{'\n'}Plan</Text>
          </SpeakablePress>

          <SpeakablePress text={`Toplam ${plans.length} plan`} speakOnly
            style={[s.summaryCard, { backgroundColor: colors.infoSoft }]}>
            <Text style={s.summaryEmoji}>📅</Text>
            <Text style={[s.summaryNum, { color: colors.info }]}>{plans.length}</Text>
            <Text style={[s.summaryLabel, { color: colors.textMuted }]}>Toplam{'\n'}Plan</Text>
          </SpeakablePress>
        </View>
      </AnimatedCard>

      {/* BUGÜNKÜ İLAÇLAR */}
      <AnimatedCard delay={200}>
        <View style={[s.card, { backgroundColor: colors.card }]}>
          <SpeakablePress
            text={`Bugünkü ilaçlar. ${TODAY} günü ${medicines.length} ilaç var.`}
            speakOnly style={s.cardHeader}
          >
            <View style={s.cardTitleRow}>
              <View style={[s.cardIconBox, { backgroundColor: colors.primarySoft }]}>
                <Text style={{ fontSize: 18 }}>💊</Text>
              </View>
              <Text style={[s.cardTitle, { color: colors.text }]}>Bugünkü İlaçlar</Text>
            </View>
            <View style={[s.dayBadge, { backgroundColor: colors.primarySoft }]}>
              <Text style={[s.dayBadgeText, { color: colors.primary }]}>{TODAY}</Text>
            </View>
          </SpeakablePress>

          {medicines.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={[s.emptyText, { color: colors.textMuted }]}>Bugün için ilaç yok 🎉</Text>
            </View>
          ) : (
            medicines.map((med, index) => {
              const isTaken = takenIds.includes(med.id)
              return (
                <View key={med.id} style={[
                  s.medRow,
                  { borderLeftColor: med.color || colors.primary },
                  index < medicines.length - 1 && [s.medRowBorder, { borderBottomColor: colors.border }]
                ]}>
                  <View style={[s.medIconBox, { backgroundColor: (med.color || colors.primary) + '20' }]}>
                    <Text style={{ fontSize: 22 }}>{med.icon || '💊'}</Text>
                  </View>
                  <SpeakablePress
                    text={`${med.name}. ${med.dose ? 'Doz: ' + med.dose + '.' : ''} Saatler: ${med.times?.join(', ')}.`}
                    speakOnly style={s.medInfo}
                  >
                    <Text style={[s.medName, { color: colors.text }]}>{med.name}</Text>
                    <Text style={[s.medDose, { color: colors.textMuted }]}>{med.dose}</Text>
                    <Text style={[s.medTimes, { color: colors.secondary }]}>🕐 {med.times?.join(' • ')}</Text>
                  </SpeakablePress>
                  <SpeakablePress
                    text={isTaken ? `${med.name} zaten alındı` : `${med.name} alındı olarak işaretle`}
                    onPress={() => markTaken(med)}
                    style={[s.takenBtn, { backgroundColor: colors.border }, isTaken && { backgroundColor: colors.success }]}
                  >
                    <Text style={[s.takenBtnText, { color: colors.textMuted }, isTaken && { color: 'white' }]}>
                      {isTaken ? '✅' : '○'}
                    </Text>
                  </SpeakablePress>
                </View>
              )
            })
          )}
        </View>
      </AnimatedCard>

      {/* BUGÜNKÜ PLANLAR */}
      <AnimatedCard delay={300}>
        <View style={[s.card, { backgroundColor: colors.card }]}>
          <SpeakablePress
            text={`Bugünkü planlar. Toplam ${plans.length} plan.`}
            speakOnly style={s.cardHeader}
          >
            <View style={s.cardTitleRow}>
              <View style={[s.cardIconBox, { backgroundColor: colors.accentSoft }]}>
                <Text style={{ fontSize: 18 }}>📋</Text>
              </View>
              <Text style={[s.cardTitle, { color: colors.text }]}>Bugünkü Planlar</Text>
            </View>
            <Text style={[s.cardSub, { color: colors.textMuted }]}>{plans.length} plan</Text>
          </SpeakablePress>

          {plans.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={[s.emptyText, { color: colors.textMuted }]}>Bugün için plan yok</Text>
            </View>
          ) : (
            plans.slice(0, 5).map((plan, index) => (
              <SpeakablePress
                key={plan.id}
                text={`${plan.is_done ? 'Tamamlandı' : 'Yapılacak'}: ${plan.title}. ${plan.plan_time ? 'Saat ' + plan.plan_time.slice(0, 5) : ''}`}
                speakOnly
                style={[
                  s.planRow,
                  index < Math.min(plans.length, 5) - 1 && [s.planRowBorder, { borderBottomColor: colors.border }]
                ]}
              >
                <Text style={{ fontSize: 20 }}>{plan.is_done ? '✅' : '⭕'}</Text>
                <View style={s.planInfo}>
                  <Text style={[s.planTitle, { color: colors.text }, plan.is_done && { textDecorationLine: 'line-through', color: colors.textMuted }]}>
                    {plan.title}
                  </Text>
                  {plan.plan_time && (
                    <Text style={[s.planTime, { color: colors.textMuted }]}>🕐 {plan.plan_time.slice(0, 5)}</Text>
                  )}
                </View>
              </SpeakablePress>
            ))
          )}
          {plans.length > 5 && (
            <Text style={[s.moreText, { color: colors.primary }]}>+{plans.length - 5} plan daha...</Text>
          )}
        </View>
      </AnimatedCard>

      {/* MOTİVASYON */}
      <AnimatedCard delay={400}>
        <SpeakablePress text={motivationText} speakOnly>
          <LinearGradient
            colors={progress === 100 ? ['#06D6A0', '#4CC9F0'] : progress >= 50 ? ['#4361EE', '#4CC9F0'] : ['#7209B7', '#4361EE']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.motivationCard}
          >
            <Text style={s.motivationText}>
              {progress === 100 ? '🌟 Harika! Tüm planlarını tamamladın!' :
               progress >= 50 ? '💪 Çok iyi gidiyorsun, devam et!' : '☀️ Güzel bir gün seni bekliyor!'}
            </Text>
          </LinearGradient>
        </SpeakablePress>
      </AnimatedCard>

      <View style={{ height: 30 }} />
    </ScrollView>
  )
}

const makeStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16 },
  headerCard: { borderRadius: RADIUS.lg, padding: 22, marginBottom: 16, overflow: 'hidden', ...SHADOW.lg },
  circle1: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.1)', top: -50, right: -40 },
  circle2: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.08)', bottom: -40, left: 20 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  greetingText: { fontSize: FONTS.sm, color: 'rgba(255,255,255,0.85)', fontWeight: '600', marginBottom: 2 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  userName: { fontSize: FONTS.xl, fontWeight: '900', color: 'white' },
  userNameArrow: { fontSize: 28, color: 'rgba(255,255,255,0.7)', marginLeft: 6, fontWeight: '300' },
  dateText: { fontSize: FONTS.xs, color: 'rgba(255,255,255,0.8)' },
  clockBox: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.md, padding: 12, alignItems: 'center', minWidth: 70 },
  clockText: { fontSize: FONTS.xl, fontWeight: '900', color: 'white' },
  clockLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  progressSection: {},
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: FONTS.sm, color: 'rgba(255,255,255,0.9)', fontWeight: '700' },
  progressPercent: { fontSize: FONTS.sm, color: 'white', fontWeight: '900' },
  progressTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 4, marginBottom: 6 },
  progressFill: { height: 8, backgroundColor: 'white', borderRadius: 4 },
  progressSub: { fontSize: FONTS.xs, color: 'rgba(255,255,255,0.8)' },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  summaryCard: { flex: 1, borderRadius: RADIUS.md, padding: 12, alignItems: 'center', ...SHADOW.sm },
  summaryEmoji: { fontSize: 22, marginBottom: 4 },
  summaryNum: { fontSize: FONTS.xl, fontWeight: '900' },
  summaryLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  card: { borderRadius: RADIUS.lg, padding: 18, marginBottom: 14, ...SHADOW.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: FONTS.md, fontWeight: '800' },
  cardSub: { fontSize: FONTS.xs, fontWeight: '700' },
  dayBadge: { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
  dayBadgeText: { fontSize: FONTS.xs, fontWeight: '800' },
  emptyBox: { paddingVertical: 16, alignItems: 'center' },
  emptyText: { fontSize: FONTS.sm },
  medRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderLeftWidth: 3, paddingLeft: 12, marginLeft: -6 },
  medRowBorder: { borderBottomWidth: 1 },
  medIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  medInfo: { flex: 1 },
  medName: { fontSize: FONTS.md, fontWeight: '800' },
  medDose: { fontSize: FONTS.xs, marginTop: 1 },
  medTimes: { fontSize: FONTS.xs, fontWeight: '700', marginTop: 2 },
  takenBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  takenBtnText: { fontSize: 18 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  planRowBorder: { borderBottomWidth: 1 },
  planInfo: { flex: 1 },
  planTitle: { fontSize: FONTS.md, fontWeight: '700' },
  planTime: { fontSize: FONTS.xs, marginTop: 2 },
  moreText: { fontSize: FONTS.xs, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  motivationCard: { borderRadius: RADIUS.lg, padding: 18, alignItems: 'center', ...SHADOW.md },
  motivationText: { fontSize: FONTS.md, fontWeight: '800', color: 'white', textAlign: 'center' },
})