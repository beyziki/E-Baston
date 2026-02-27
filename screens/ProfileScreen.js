import { useState, useEffect, useRef } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, Animated } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '../lib/supabase'
import { FONTS, RADIUS, SHADOW } from '../lib/theme'
import { useTheme, ThemeToggleButton } from '../lib/ThemeContext'
import { SpeakablePress, SpeechToggleButton, useSpeech } from '../lib/SpeechContext'
import { useUser, useStats } from '../lib/useData'

function AnimatedCard({ children, delay = 0 }) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 500, delay, useNativeDriver: true }).start()
  }, [])
  return (
    <Animated.View style={{
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
    }}>
      {children}
    </Animated.View>
  )
}

export default function ProfileScreen() {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState({ full_name: '', phone: '', birth_date: '' })
  const { speak } = useSpeech()
  const { colors } = useTheme()

  const { user, profile, loading, saveProfile } = useUser()
  const { stats } = useStats()

  // Form'u profil yüklenince doldur
  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        birth_date: profile.birth_date || '',
      })
    }
  }, [profile])

  async function handleSave() {
    setSaving(true)
    const result = await saveProfile(form)
    setSaving(false)
    if (!result.success) { Alert.alert('Hata', result.error); return }
    setEditing(false)
    speak('Profil bilgileriniz kaydedildi.')
  }

  async function handleLogout() {
    Alert.alert('Çıkış Yap', 'Hesabınızdan çıkmak istediğinizden emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: () => supabase.auth.signOut() }
    ])
  }

  const initials = form.full_name
    ? form.full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || '?'

  if (loading) return (
    <LinearGradient colors={['#4361EE', '#7209B7']} style={styles.loadingScreen}>
      <Text style={styles.loadingText}>👤 Profil yükleniyor...</Text>
    </LinearGradient>
  )

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* HEADER */}
        <AnimatedCard delay={0}>
          <LinearGradient colors={['#4361EE', '#7209B7', '#4CC9F0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerCard}>
            <View style={styles.circle1} /><View style={styles.circle2} />
            <View style={styles.headerTop}>
              <SpeakablePress text={`Profil sayfası. ${form.full_name || 'İsim girilmemiş'}`} speakOnly style={{ flex: 1 }}>
                <Text style={styles.headerLabel}>Hesabım</Text>
                <Text style={styles.headerTitle}>👤 Profilim</Text>
              </SpeakablePress>
              <View style={{ gap: 8 }}>
                <SpeechToggleButton />
                <ThemeToggleButton />
              </View>
            </View>
            <View style={styles.avatarRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.avatarInfo}>
                <Text style={styles.avatarName}>{form.full_name || 'İsim girilmemiş'}</Text>
                <Text style={styles.avatarEmail}>{user?.email}</Text>
              </View>
            </View>
          </LinearGradient>
        </AnimatedCard>

        {/* İSTATİSTİKLER */}
        <AnimatedCard delay={100}>
          <View style={styles.statsRow}>
            {[
              { num: stats.medCount, icon: '💊', label: 'İlaç' },
              { num: stats.planCount, icon: '📅', label: 'Plan' },
              { num: stats.familyCount, icon: '👨‍👩‍👧', label: 'Aile' },
            ].map((s, i) => (
              <View key={i} style={[styles.statCard, { backgroundColor: colors.card }]}>
                <Text style={[styles.statNum, { color: colors.primary }]}>{s.num}</Text>
                <Text style={styles.statIcon}>{s.icon}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        </AnimatedCard>

        {/* PROFİL BİLGİLERİ */}
        <AnimatedCard delay={200}>
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>📋 Kişisel Bilgiler</Text>
              <TouchableOpacity
                onPress={() => editing ? handleSave() : setEditing(true)}
                style={[styles.editBtn, { backgroundColor: colors.primarySoft }]}
                disabled={saving}
              >
                <Text style={[styles.editBtnText, { color: colors.primary }]}>
                  {saving ? '⏳' : editing ? '✅ Kaydet' : '✏️ Düzenle'}
                </Text>
              </TouchableOpacity>
            </View>

            {[
              { label: 'Ad Soyad', key: 'full_name', placeholder: 'Adınız Soyadınız' },
              { label: 'Telefon', key: 'phone', placeholder: '05XX XXX XX XX', keyboardType: 'phone-pad' },
              { label: 'Doğum Tarihi', key: 'birth_date', placeholder: 'GG.AA.YYYY' },
            ].map(field => (
              <View key={field.key} style={styles.fieldRow}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{field.label}</Text>
                {editing ? (
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                    value={form[field.key]}
                    onChangeText={v => setForm(p => ({ ...p, [field.key]: v }))}
                    placeholder={field.placeholder}
                    placeholderTextColor={colors.textMuted}
                    keyboardType={field.keyboardType || 'default'}
                  />
                ) : (
                  <Text style={[styles.fieldValue, { color: colors.text }]}>{form[field.key] || '—'}</Text>
                )}
              </View>
            ))}

            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>E-posta</Text>
              <Text style={[styles.fieldValue, { color: colors.textMuted }]}>{user?.email}</Text>
            </View>

            {editing && (
              <TouchableOpacity onPress={() => setEditing(false)} style={styles.cancelBtn}>
                <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>İptal</Text>
              </TouchableOpacity>
            )}
          </View>
        </AnimatedCard>

        {/* ÇIKIŞ */}
        <AnimatedCard delay={300}>
          <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: colors.dangerSoft }]} onPress={handleLogout}>
            <Text style={styles.logoutText}>🚪 Çıkış Yap</Text>
          </TouchableOpacity>
        </AnimatedCard>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 100 },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: 'white', fontSize: 18, fontWeight: '700' },
  headerCard: { borderRadius: 24, padding: 20, marginBottom: 16, overflow: 'hidden', ...SHADOW.lg },
  circle1: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.07)', top: -40, right: -40 },
  circle2: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -20, left: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  headerLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '700', marginBottom: 4 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: 'white' },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  avatarText: { fontSize: 24, fontWeight: '900', color: 'white' },
  avatarInfo: { flex: 1 },
  avatarName: { fontSize: 18, fontWeight: '800', color: 'white', marginBottom: 4 },
  avatarEmail: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', ...SHADOW.sm },
  statNum: { fontSize: 28, fontWeight: '900', marginBottom: 2 },
  statIcon: { fontSize: 20, marginBottom: 4 },
  statLabel: { fontSize: 12, fontWeight: '700' },
  section: { borderRadius: 20, padding: 20, marginBottom: 16, ...SHADOW.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  editBtn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  editBtnText: { fontSize: 13, fontWeight: '700' },
  fieldRow: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  fieldValue: { fontSize: 15, fontWeight: '600' },
  input: { borderRadius: 10, padding: 12, fontSize: 15, borderWidth: 2 },
  cancelBtn: { alignItems: 'center', marginTop: 8, padding: 10 },
  cancelBtnText: { fontSize: 14, fontWeight: '700' },
  logoutBtn: { borderRadius: 16, padding: 18, alignItems: 'center', ...SHADOW.sm },
  logoutText: { fontSize: 16, fontWeight: '800', color: '#E05050' },
})