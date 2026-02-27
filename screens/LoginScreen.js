import { useState, useEffect, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, Animated, ScrollView
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '../lib/supabase'
import { FONTS, RADIUS, SHADOW } from '../lib/theme'
import { useTheme } from '../lib/ThemeContext'
import { SpeakablePress, SpeechToggleButton } from '../lib/SpeechContext'

export default function LoginScreen({ onLogin }) {
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [loading, setLoading]       = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { colors } = useTheme()

  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(40)).current
  const logoAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.sequence([
      Animated.timing(logoAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ])
    ]).start()
  }, [])

  async function handleAuth() {
    if (!email || !password) { Alert.alert('Hata', 'E-posta ve şifre giriniz'); return }
    setLoading(true)
    if (isRegister) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) Alert.alert('Hata', error.message)
      else Alert.alert('Başarılı! 🎉', 'E-postanızı doğrulayın, sonra giriş yapın.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) Alert.alert('Hata', error.message)
      else onLogin()
    }
    setLoading(false)
  }

  return (
    <LinearGradient
      colors={['#4361EE', '#7209B7', '#4CC9F0']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <View style={styles.circle1} />
      <View style={styles.circle2} />
      <View style={styles.circle3} />
      <SpeechToggleButton style={styles.speechBtn} />

      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* LOGO */}
          <Animated.View style={[styles.logoArea, {
            opacity: logoAnim,
            transform: [{ scale: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }]
          }]}>
            <SpeakablePress text="CanBakım. Yapay Zeka Destekli Bakım Asistanı" speakOnly style={styles.logoInner}>
              <View style={styles.logoCircle}>
                <Text style={styles.logoEmoji}>🏥</Text>
              </View>
              <Text style={styles.logoText}>CanBakım</Text>
              <Text style={styles.logoSub}>Yapay Zeka Destekli Bakım Asistanı</Text>
            </SpeakablePress>
          </Animated.View>

          {/* FORM KARTI */}
          <Animated.View style={[styles.card, { backgroundColor: colors.card, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <SpeakablePress
              text={isRegister ? 'Yeni hesap oluştur. Bilgilerinizi girerek kaydolun.' : 'Tekrar hoş geldiniz. Hesabınıza giriş yapın.'}
              speakOnly
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {isRegister ? '👤 Yeni Hesap Oluştur' : '👋 Tekrar Hoş Geldiniz'}
              </Text>
              <Text style={[styles.cardSub, { color: colors.textMuted }]}>
                {isRegister ? 'Bilgilerinizi girerek kaydolun' : 'Hesabınıza giriş yapın'}
              </Text>
            </SpeakablePress>

            {/* E-POSTA */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMid }]}>📧 E-posta</Text>
              <View style={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="ornek@email.com"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* ŞİFRE */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMid }]}>🔒 Şifre</Text>
              <View style={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.input, { flex: 1, color: colors.text }]}
                  placeholder="En az 6 karakter"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <SpeakablePress
                  text={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                >
                  <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                </SpeakablePress>
              </View>
            </View>

            {/* GİRİŞ BUTONU */}
            <SpeakablePress
              text={loading ? 'Lütfen bekleyin' : isRegister ? 'Kayıt ol butonu' : 'Giriş yap butonu'}
              onPress={handleAuth}
              style={styles.btnWrapper}
            >
              <LinearGradient
                colors={['#4361EE', '#4CC9F0']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.btn, loading && styles.btnDisabled]}
              >
                <Text style={styles.btnText}>
                  {loading ? '⏳ Lütfen bekleyin...' : isRegister ? '🚀 Kayıt Ol' : '✨ Giriş Yap'}
                </Text>
              </LinearGradient>
            </SpeakablePress>

            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textMuted }]}>veya</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            <SpeakablePress
              text={isRegister ? 'Zaten hesabın var mı? Giriş yap' : 'Hesabın yok mu? Kayıt ol'}
              onPress={() => setIsRegister(!isRegister)}
              style={styles.switchBtn}
            >
              <Text style={[styles.switchText, { color: colors.textMid }]}>
                {isRegister ? 'Zaten hesabın var mı? ' : 'Hesabın yok mu? '}
                <Text style={[styles.switchTextBold, { color: colors.primary }]}>
                  {isRegister ? 'Giriş Yap' : 'Kayıt Ol'}
                </Text>
              </Text>
            </SpeakablePress>
          </Animated.View>

          <Animated.View style={{ opacity: fadeAnim }}>
            <Text style={styles.footerText}>🔒 Verileriniz güvenle saklanmaktadır</Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  circle1: { position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(255,255,255,0.1)', top: -80, right: -60 },
  circle2: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)', top: 100, left: -60 },
  circle3: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.08)', bottom: 80, right: -30 },
  speechBtn: { position: 'absolute', top: 54, right: 20, zIndex: 99 },
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: 80, paddingBottom: 40 },
  logoArea: { alignItems: 'center', marginBottom: 32 },
  logoInner: { alignItems: 'center' },
  logoCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, ...SHADOW.lg },
  logoEmoji: { fontSize: 44 },
  logoText: { fontSize: 38, fontWeight: '900', color: 'white', letterSpacing: -1, marginBottom: 6 },
  logoSub: { fontSize: FONTS.sm, color: 'rgba(255,255,255,0.85)', fontWeight: '600', textAlign: 'center' },
  card: { borderRadius: RADIUS.xl, padding: 28, marginBottom: 20, ...SHADOW.lg },
  cardTitle: { fontSize: FONTS.lg, fontWeight: '900', marginBottom: 4 },
  cardSub: { fontSize: FONTS.sm, marginBottom: 24 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: FONTS.sm, fontWeight: '700', marginBottom: 8 },
  inputBox: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.md, borderWidth: 2, paddingHorizontal: 16 },
  input: { fontSize: FONTS.md, paddingVertical: 14, flex: 1 },
  eyeBtn: { padding: 8 },
  eyeIcon: { fontSize: 20 },
  btnWrapper: { marginTop: 8, marginBottom: 20, borderRadius: RADIUS.md, overflow: 'hidden' },
  btn: { padding: 18, alignItems: 'center', borderRadius: RADIUS.md },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: 'white', fontSize: FONTS.md, fontWeight: '900', letterSpacing: 0.5 },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: FONTS.xs, fontWeight: '600' },
  switchBtn: { alignItems: 'center' },
  switchText: { fontSize: FONTS.sm },
  switchTextBold: { fontWeight: '900' },
  footerText: { textAlign: 'center', fontSize: FONTS.xs, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
})