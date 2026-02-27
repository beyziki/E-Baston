import { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Animated } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '../lib/supabase'
import { FONTS, RADIUS, SHADOW } from '../lib/theme'
import { useTheme } from '../lib/ThemeContext'
import { SpeakablePress, SpeechToggleButton } from '../lib/SpeechContext'

const { width: SW } = Dimensions.get('window')
const CHART_W = SW - 64
const CHART_H = 140

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

// Basit çubuk grafik komponenti
function BarChart({ data, color, unit = '', maxVal }) {
  if (!data?.length) return null
  const max = maxVal || Math.max(...data.map(d => d.value || 0)) || 1
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_H, gap: 4 }}>
      {data.map((item, i) => {
        const barH = max > 0 ? Math.max(4, (item.value / max) * CHART_H) : 4
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
            <Text style={{ fontSize: 9, color: '#888', marginBottom: 2 }}>
              {item.value || '-'}
            </Text>
            <LinearGradient
              colors={[color + 'BB', color]}
              style={{ width: '100%', height: barH, borderRadius: 4 }}
            />
            <Text style={{ fontSize: 9, color: '#888', marginTop: 4 }} numberOfLines={1}>
              {item.label}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

// Çizgi grafik için basit SVG-like path (View tabanlı)
function LineChart({ data, color }) {
  if (!data?.length || data.length < 2) return null
  const validData = data.filter(d => d.value != null)
  if (validData.length < 2) return null

  const max = Math.max(...validData.map(d => d.value))
  const min = Math.min(...validData.map(d => d.value))
  const range = max - min || 1

  const points = validData.map((item, i) => ({
    x: (i / (validData.length - 1)) * CHART_W,
    y: CHART_H - ((item.value - min) / range) * (CHART_H - 20) - 10,
    label: item.label,
    value: item.value,
  }))

  return (
    <View style={{ height: CHART_H + 20, position: 'relative' }}>
      {/* Yatay referans çizgileri */}
      {[0, 0.25, 0.5, 0.75, 1].map(p => (
        <View key={p} style={{
          position: 'absolute',
          left: 0, right: 0,
          top: CHART_H * (1 - p),
          height: 1,
          backgroundColor: '#E2E8FF',
        }} />
      ))}

      {/* Noktalar ve bağlantı çizgileri */}
      {points.map((pt, i) => (
        <View key={i}>
          {/* Nokta */}
          <View style={{
            position: 'absolute',
            left: pt.x - 5, top: pt.y - 5,
            width: 10, height: 10,
            borderRadius: 5,
            backgroundColor: color,
            borderWidth: 2,
            borderColor: 'white',
            shadowColor: color,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.4,
            shadowRadius: 3,
            elevation: 3,
          }} />
          {/* Değer etiketi */}
          <Text style={{
            position: 'absolute',
            left: pt.x - 15, top: pt.y - 20,
            fontSize: 9, fontWeight: '700',
            color: color, width: 30, textAlign: 'center',
          }}>
            {pt.value}
          </Text>
          {/* Tarih etiketi */}
          <Text style={{
            position: 'absolute',
            left: pt.x - 15, top: CHART_H + 4,
            fontSize: 8, color: '#999',
            width: 30, textAlign: 'center',
          }} numberOfLines={1}>
            {pt.label}
          </Text>
        </View>
      ))}
    </View>
  )
}

// İlaç uyum oranı halkası
function ComplianceRing({ percent, color, size = 80 }) {
  const r = (size - 12) / 2
  const circumference = 2 * Math.PI * r
  const filled = (percent / 100) * circumference

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Arka plan dairesi */}
      <View style={{
        position: 'absolute',
        width: size, height: size,
        borderRadius: size / 2,
        borderWidth: 6,
        borderColor: color + '25',
      }} />
      {/* Dolu kısım (çeyrek döndürme ile) */}
      <View style={{
        position: 'absolute',
        width: size, height: size,
        borderRadius: size / 2,
        borderWidth: 6,
        borderColor: 'transparent',
        borderTopColor: percent > 0 ? color : 'transparent',
        borderRightColor: percent > 25 ? color : 'transparent',
        borderBottomColor: percent > 50 ? color : 'transparent',
        borderLeftColor: percent > 75 ? color : 'transparent',
        transform: [{ rotate: '-90deg' }],
      }} />
      <Text style={{ fontSize: 14, fontWeight: '900', color }}>{percent}%</Text>
    </View>
  )
}

export default function StatsScreen() {
  const [period, setPeriod] = useState(7) // 7 veya 30 gün
  const [healthData, setHealthData] = useState([])
  const [medicineStats, setMedicineStats] = useState({ total: 0, taken: 0, compliance: 0 })
  const [planStats, setPlanStats] = useState({ total: 0, done: 0, compliance: 0 })
  const [topMeds, setTopMeds] = useState([])
  const [loading, setLoading] = useState(true)
  const { colors } = useTheme()

  useEffect(() => { fetchStats() }, [period])

  async function fetchStats() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - period)
    const start = startDate.toISOString().split('T')[0]
    const end = endDate.toISOString().split('T')[0]

    const [healthRes, medsRes, logsRes, plansRes] = await Promise.all([
      supabase.from('health_records')
        .select('*').eq('user_id', user.id)
        .gte('recorded_at', start + 'T00:00:00')
        .order('recorded_at', { ascending: true })
        .limit(period),
      supabase.from('medicines').select('id,name,icon,color').eq('user_id', user.id),
      supabase.from('medicine_taken_logs')
        .select('medicine_id,taken_date').eq('user_id', user.id)
        .gte('taken_date', start),
      supabase.from('plans')
        .select('id,is_done').eq('user_id', user.id)
        .gte('plan_date', start).lte('plan_date', end),
    ])

    // Sağlık verileri grafik için
    setHealthData(healthRes.data || [])

    // İlaç uyum
    const meds = medsRes.data || []
    const logs = logsRes.data || []
    const uniqueTakenDays = new Set(logs.map(l => l.taken_date)).size
    const expectedDays = Math.min(period, Math.max(1, uniqueTakenDays + 1))
    const compliance = meds.length > 0 && expectedDays > 0
      ? Math.round((uniqueTakenDays / period) * 100)
      : 0
    setMedicineStats({ total: meds.length, taken: logs.length, compliance: Math.min(100, compliance) })

    // İlaç bazlı alım sayısı
    const medCounts = {}
    logs.forEach(l => { medCounts[l.medicine_id] = (medCounts[l.medicine_id] || 0) + 1 })
    const top = meds.map(m => ({
      ...m,
      takenCount: medCounts[m.id] || 0,
    })).sort((a, b) => b.takenCount - a.takenCount).slice(0, 5)
    setTopMeds(top)

    // Plan uyum
    const plans = plansRes.data || []
    const donePlans = plans.filter(p => p.is_done).length
    setPlanStats({
      total: plans.length,
      done: donePlans,
      compliance: plans.length > 0 ? Math.round((donePlans / plans.length) * 100) : 0,
    })

    setLoading(false)
  }

  // Sağlık verilerini grafik formatına çevir
  function getHealthChartData(field) {
    return healthData.slice(-10).map(r => ({
      value: r[field],
      label: new Date(r.recorded_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'numeric' }),
    })).filter(d => d.value != null)
  }

  // Kan basıncı için sadece sistolik
  function getBPChartData() {
    return healthData.slice(-10).map(r => {
      const sys = r.blood_pressure ? parseInt(r.blood_pressure.split('/')[0]) : null
      return {
        value: sys,
        label: new Date(r.recorded_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'numeric' }),
      }
    }).filter(d => d.value != null)
  }

  const s = makeStyles(colors)

  if (loading) return (
    <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ fontSize: 32 }}>📊</Text>
      <Text style={[s.loadingText, { color: colors.textMuted }]}>İstatistikler yükleniyor...</Text>
    </View>
  )

  return (
    <ScrollView style={s.container} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

      {/* HEADER */}
      <AnimatedCard delay={0}>
        <LinearGradient colors={['#4361EE', '#7209B7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.headerCard}>
          <View style={s.circle1} /><View style={s.circle2} />
          <View style={s.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={s.headerLabel}>Sağlık Analizi</Text>
              <Text style={s.headerTitle}>📊 İstatistikler</Text>
            </View>
            <SpeechToggleButton />
          </View>

          {/* Dönem seçici */}
          <View style={s.periodRow}>
            {[7, 14, 30].map(p => (
              <TouchableOpacity
                key={p}
                onPress={() => setPeriod(p)}
                style={[s.periodBtn, period === p && s.periodBtnActive]}
              >
                <Text style={[s.periodBtnText, period === p && s.periodBtnTextActive]}>
                  {p} Gün
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </LinearGradient>
      </AnimatedCard>

      {/* UYUM KARTLARI */}
      <AnimatedCard delay={100}>
        <View style={s.complianceRow}>
          <SpeakablePress
            text={`İlaç uyumu yüzde ${medicineStats.compliance}`}
            speakOnly
            style={[s.complianceCard, { backgroundColor: colors.card }]}
          >
            <ComplianceRing percent={medicineStats.compliance} color={colors.primary} />
            <Text style={[s.complianceLabel, { color: colors.text }]}>İlaç Uyumu</Text>
            <Text style={[s.complianceSub, { color: colors.textMuted }]}>
              {medicineStats.taken} alım / {period} gün
            </Text>
          </SpeakablePress>

          <SpeakablePress
            text={`Plan tamamlama oranı yüzde ${planStats.compliance}`}
            speakOnly
            style={[s.complianceCard, { backgroundColor: colors.card }]}
          >
            <ComplianceRing percent={planStats.compliance} color={colors.success} size={80} />
            <Text style={[s.complianceLabel, { color: colors.text }]}>Plan Tamamlama</Text>
            <Text style={[s.complianceSub, { color: colors.textMuted }]}>
              {planStats.done}/{planStats.total} plan
            </Text>
          </SpeakablePress>
        </View>
      </AnimatedCard>

      {/* TANSIYON GRAFİĞİ */}
      {getBPChartData().length >= 2 && (
        <AnimatedCard delay={150}>
          <View style={[s.chartCard, { backgroundColor: colors.card }]}>
            <View style={s.chartHeader}>
              <Text style={{ fontSize: 20 }}>🩺</Text>
              <Text style={[s.chartTitle, { color: colors.text }]}>Tansiyon (Sistolik)</Text>
            </View>
            <View style={{ paddingTop: 8 }}>
              <LineChart data={getBPChartData()} color="#4361EE" />
            </View>
            <View style={[s.referenceRow, { backgroundColor: colors.primarySoft }]}>
              <Text style={[s.referenceText, { color: colors.primary }]}>
                Normal: 90–120 mmHg
              </Text>
            </View>
          </View>
        </AnimatedCard>
      )}

      {/* KAN ŞEKERİ GRAFİĞİ */}
      {getHealthChartData('blood_sugar').length >= 2 && (
        <AnimatedCard delay={200}>
          <View style={[s.chartCard, { backgroundColor: colors.card }]}>
            <View style={s.chartHeader}>
              <Text style={{ fontSize: 20 }}>🩸</Text>
              <Text style={[s.chartTitle, { color: colors.text }]}>Kan Şekeri (mg/dL)</Text>
            </View>
            <View style={{ paddingTop: 8 }}>
              <LineChart data={getHealthChartData('blood_sugar')} color="#7209B7" />
            </View>
            <View style={[s.referenceRow, { backgroundColor: colors.accentSoft }]}>
              <Text style={[s.referenceText, { color: colors.accent }]}>Normal: 70–100 mg/dL</Text>
            </View>
          </View>
        </AnimatedCard>
      )}

      {/* NABIZ GRAFİĞİ */}
      {getHealthChartData('pulse').length >= 2 && (
        <AnimatedCard delay={250}>
          <View style={[s.chartCard, { backgroundColor: colors.card }]}>
            <View style={s.chartHeader}>
              <Text style={{ fontSize: 20 }}>💓</Text>
              <Text style={[s.chartTitle, { color: colors.text }]}>Nabız (bpm)</Text>
            </View>
            <View style={{ paddingTop: 8 }}>
              <LineChart data={getHealthChartData('pulse')} color="#E05050" />
            </View>
            <View style={[s.referenceRow, { backgroundColor: '#E0505015' }]}>
              <Text style={[s.referenceText, { color: '#E05050' }]}>Normal: 60–100 bpm</Text>
            </View>
          </View>
        </AnimatedCard>
      )}

      {/* KİLO GRAFİĞİ */}
      {getHealthChartData('weight').length >= 2 && (
        <AnimatedCard delay={300}>
          <View style={[s.chartCard, { backgroundColor: colors.card }]}>
            <View style={s.chartHeader}>
              <Text style={{ fontSize: 20 }}>⚖️</Text>
              <Text style={[s.chartTitle, { color: colors.text }]}>Kilo (kg)</Text>
            </View>
            <View style={{ paddingTop: 8 }}>
              <LineChart data={getHealthChartData('weight')} color="#06D6A0" />
            </View>
          </View>
        </AnimatedCard>
      )}

      {/* Veri yoksa boş durum */}
      {healthData.length === 0 && (
        <AnimatedCard delay={150}>
          <View style={[s.emptyCard, { backgroundColor: colors.card }]}>
            <Text style={{ fontSize: 40 }}>📈</Text>
            <Text style={[s.emptyTitle, { color: colors.text }]}>Henüz grafik yok</Text>
            <Text style={[s.emptySub, { color: colors.textMuted }]}>
              Sağlığım ekranından ölçüm ekleyince grafikler burada görünür.
            </Text>
          </View>
        </AnimatedCard>
      )}

      {/* EN ÇOK ALINAN İLAÇLAR */}
      {topMeds.length > 0 && (
        <AnimatedCard delay={350}>
          <View style={[s.chartCard, { backgroundColor: colors.card }]}>
            <View style={s.chartHeader}>
              <Text style={{ fontSize: 20 }}>💊</Text>
              <Text style={[s.chartTitle, { color: colors.text }]}>İlaç Alım Sayısı ({period} gün)</Text>
            </View>
            <View style={{ marginTop: 12 }}>
              <BarChart
                data={topMeds.map(m => ({ value: m.takenCount, label: m.name?.slice(0, 6) || '?' }))}
                color={colors.primary}
                maxVal={period}
              />
            </View>
            <View style={{ marginTop: 16, gap: 8 }}>
              {topMeds.map((med, i) => (
                <SpeakablePress
                  key={med.id}
                  text={`${med.name}: ${med.takenCount} kez alındı`}
                  speakOnly
                  style={s.medStatRow}
                >
                  <Text style={{ fontSize: 18 }}>{med.icon || '💊'}</Text>
                  <Text style={[s.medStatName, { color: colors.text }]} numberOfLines={1}>
                    {med.name}
                  </Text>
                  <View style={[s.medStatBar, { backgroundColor: colors.border }]}>
                    <View style={[s.medStatFill, {
                      backgroundColor: med.color || colors.primary,
                      width: `${Math.min(100, (med.takenCount / Math.max(1, period)) * 100)}%`
                    }]} />
                  </View>
                  <Text style={[s.medStatCount, { color: colors.primary }]}>{med.takenCount}x</Text>
                </SpeakablePress>
              ))}
            </View>
          </View>
        </AnimatedCard>
      )}

      {/* ÖZET KUTUSU */}
      <AnimatedCard delay={400}>
        <LinearGradient colors={['#4361EE20', '#7209B720']} style={[s.summaryBox, { borderColor: colors.border }]}>
          <Text style={[s.summaryBoxTitle, { color: colors.text }]}>📋 {period} Günlük Özet</Text>
          <View style={s.summaryBoxGrid}>
            {[
              { emoji: '💊', label: 'Toplam İlaç', value: medicineStats.total },
              { emoji: '✅', label: 'İlaç Alımı', value: medicineStats.taken },
              { emoji: '📅', label: 'Toplam Plan', value: planStats.total },
              { emoji: '🎯', label: 'Tamamlanan', value: planStats.done },
              { emoji: '📊', label: 'Ölçüm Kaydı', value: healthData.length },
            ].map((item, i) => (
              <View key={i} style={[s.summaryBoxItem, { backgroundColor: colors.card }]}>
                <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
                <Text style={[s.summaryBoxNum, { color: colors.primary }]}>{item.value}</Text>
                <Text style={[s.summaryBoxLabel, { color: colors.textMuted }]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>
      </AnimatedCard>

      <View style={{ height: 100 }} />
    </ScrollView>
  )
}

const makeStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16 },
  loadingText: { marginTop: 12, fontSize: FONTS.sm },
  headerCard: { borderRadius: RADIUS.lg, padding: 22, marginBottom: 16, overflow: 'hidden', ...SHADOW.lg },
  circle1: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.08)', top: -50, right: -40 },
  circle2: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.06)', bottom: -20, left: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  headerLabel: { fontSize: FONTS.xs, color: 'rgba(255,255,255,0.75)', fontWeight: '600', marginBottom: 4 },
  headerTitle: { fontSize: FONTS.xl, fontWeight: '900', color: 'white' },
  periodRow: { flexDirection: 'row', gap: 8 },
  periodBtn: { flex: 1, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center' },
  periodBtnActive: { backgroundColor: 'white' },
  periodBtnText: { fontSize: FONTS.xs, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  periodBtnTextActive: { color: '#4361EE' },
  complianceRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  complianceCard: { flex: 1, borderRadius: RADIUS.lg, padding: 16, alignItems: 'center', ...SHADOW.md, gap: 6 },
  complianceLabel: { fontSize: FONTS.sm, fontWeight: '800', marginTop: 4 },
  complianceSub: { fontSize: FONTS.xs, textAlign: 'center' },
  chartCard: { borderRadius: RADIUS.lg, padding: 18, marginBottom: 14, ...SHADOW.md },
  chartHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  chartTitle: { fontSize: FONTS.sm, fontWeight: '800' },
  referenceRow: { borderRadius: 8, padding: 8, marginTop: 12, alignItems: 'center' },
  referenceText: { fontSize: FONTS.xs, fontWeight: '700' },
  emptyCard: { borderRadius: RADIUS.lg, padding: 32, alignItems: 'center', marginBottom: 14, ...SHADOW.md },
  emptyTitle: { fontSize: FONTS.md, fontWeight: '800', marginTop: 12 },
  emptySub: { fontSize: FONTS.sm, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  medStatRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  medStatName: { fontSize: FONTS.xs, fontWeight: '700', width: 70 },
  medStatBar: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  medStatFill: { height: 8, borderRadius: 4 },
  medStatCount: { fontSize: FONTS.xs, fontWeight: '900', width: 28, textAlign: 'right' },
  summaryBox: { borderRadius: RADIUS.lg, padding: 18, marginBottom: 14, borderWidth: 1 },
  summaryBoxTitle: { fontSize: FONTS.md, fontWeight: '800', marginBottom: 12 },
  summaryBoxGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryBoxItem: { width: '30%', borderRadius: RADIUS.md, padding: 12, alignItems: 'center', gap: 4, ...SHADOW.sm },
  summaryBoxNum: { fontSize: FONTS.xl, fontWeight: '900' },
  summaryBoxLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
})