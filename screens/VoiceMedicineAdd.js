import { useState, useRef, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated, Alert, ScrollView } from 'react-native'
import * as Speech from 'expo-speech'
import { useSpeechRecognitionEvent, ExpoSpeechRecognitionModule } from 'expo-speech-recognition'
import { supabase } from '../lib/supabase'
import { scheduleMedicineNotifications } from '../lib/notifications'
import { improveMedicineName } from '../lib/claudeAPI'
import { useVoice } from '../lib/VoiceContext'
import { useTheme } from '../lib/ThemeContext'

const STEPS = [
  { key: 'name',  question: 'İlacın adı nedir?' },
  { key: 'dose',  question: 'Dozu nedir? Örneğin beş yüz miligram.' },
  { key: 'days',  question: 'Hangi günler alacaksınız? Örneğin her gün, ya da Pazartesi Çarşamba Cuma.' },
  { key: 'times', question: 'Hangi saatlerde alacaksınız? Örneğin sabah sekiz, akşam sekiz.' },
  { key: 'note',  question: 'Bu ilaç ne için? Geçmek için "hayır" deyin.' },
]

const DAYS_MAP = {
  'pazartesi': 'Pzt', 'salı': 'Sal', 'çarşamba': 'Çar', 'carsamba': 'Çar',
  'perşembe': 'Per', 'persembe': 'Per', 'cuma': 'Cum', 'cumartesi': 'Cmt', 'pazar': 'Paz',
}

function parseDays(text) {
  if (!text) return ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
  const lower = text.toLowerCase()
  if (lower.includes('her gün') || lower.includes('hergün') || lower.includes('günlük')) return ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
  if (lower.includes('hafta içi') || lower.includes('iş günü')) return ['Pzt', 'Sal', 'Çar', 'Per', 'Cum']
  if (lower.includes('hafta sonu')) return ['Cmt', 'Paz']
  const found = []
  for (const [key, val] of Object.entries(DAYS_MAP)) {
    if (lower.includes(key) && !found.includes(val)) found.push(val)
  }
  return found.length > 0 ? found : ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
}

function parseTimes(text) {
  if (!text) return ['08:00']
  const lower = text.toLowerCase()
  const times = new Set()
  if (lower.includes('sabah')) times.add('08:00')
  if (lower.includes('öğle') || lower.includes('öğlen')) times.add('12:00')
  if (lower.includes('ikindi')) times.add('15:00')
  if (lower.includes('akşam')) times.add('20:00')
  if (lower.includes('gece')) times.add('22:00')
  const wordNums = { 'bir':1,'iki':2,'üç':3,'dört':4,'beş':5,'altı':6,'yedi':7,'sekiz':8,'dokuz':9,'on':10,'on bir':11,'on iki':12,'on üç':13,'on dört':14,'on beş':15,'on altı':16,'on yedi':17,'on sekiz':18,'on dokuz':19,'yirmi':20,'yirmi bir':21,'yirmi iki':22,'yirmi üç':23 }
  for (const [w, n] of Object.entries(wordNums)) { if (lower.includes(w)) times.add(`${String(n).padStart(2,'0')}:00`) }
  const nums = text.match(/\b([0-9]{1,2})\b/g)
  if (nums) nums.forEach(m => { const h = parseInt(m); if (h >= 0 && h <= 23) times.add(`${String(h).padStart(2,'0')}:00`) })
  return [...times].length > 0 ? [...times] : ['08:00']
}

const MED_COLORS = ['#E07B4F','#4A9B8E','#6B5B8E','#F0A500','#E05050','#4361EE']
const ICONS = ['💊','🔵','🟡','🟢','❤️','🔶']

export default function VoiceMedicineAdd({ visible, onClose, onSaved }) {
  const [step, setStep]               = useState(0)
  const [answers, setAnswers]         = useState({})
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking]   = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [partialText, setPartialText] = useState('')
  const [transcript, setTranscript]   = useState('')
  const [saving, setSaving]           = useState(false)
  const [started, setStarted]         = useState(false)
  const pulseAnim  = useRef(new Animated.Value(1)).current
  const stepRef    = useRef(0)
  const answersRef = useRef({})
  const { setActiveVoiceModule } = useVoice()
  const { colors, isDark } = useTheme()

  useEffect(() => {
    if (visible) {
      setActiveVoiceModule('medicine')
    } else {
      setActiveVoiceModule(null)
      ExpoSpeechRecognitionModule.stop()
      Speech.stop()
    }
  }, [visible])

  useSpeechRecognitionEvent('start', () => { setIsListening(true) })
  useSpeechRecognitionEvent('end',   () => { setIsListening(false); stopPulse() })
  useSpeechRecognitionEvent('error', (event) => {
    if (!visible) return
    setIsListening(false); stopPulse()
    const code = String(event.error || '')
    if (code.includes('no-speech') || code.includes('7')) {
      Alert.alert('Ses algılanamadı', 'Lütfen tekrar deneyin.')
    } else {
      Alert.alert('Ses Hatası', code)
    }
  })

  useSpeechRecognitionEvent('result', async (event) => {
    if (!visible) return
    const text = event.results?.[0]?.transcript || ''
    if (event.isFinal) {
      stopPulse(); setIsListening(false); setIsProcessing(true)
      setTranscript(text); setPartialText('')
      if (!text.trim()) { setIsProcessing(false); Alert.alert('Anlaşılamadı', 'Lütfen tekrar deneyin.'); return }
      await handleAnswer(text.trim())
      setIsProcessing(false)
    } else {
      setPartialText(text)
    }
  })

  function startPulse() {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,   duration: 600, useNativeDriver: true }),
    ])).start()
  }

  function stopPulse() { pulseAnim.stopAnimation(); pulseAnim.setValue(1) }

  async function speakText(text) {
    setIsSpeaking(true)
    return new Promise(resolve => {
      Speech.speak(text, {
        language: 'tr-TR', rate: 0.85,
        onDone: () => { setIsSpeaking(false); resolve() },
        onError: () => { setIsSpeaking(false); resolve() },
        onStopped: () => { setIsSpeaking(false); resolve() },
      })
    })
  }

  async function startStep(stepIndex) {
    stepRef.current = stepIndex
    setStep(stepIndex); setTranscript(''); setPartialText('')
    await speakText(STEPS[stepIndex].question)
    await startRecording()
  }

  async function startRecording() {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync()
    if (!result.granted) { Alert.alert('İzin Gerekli', 'Mikrofon iznine izin verin.'); return }
    ExpoSpeechRecognitionModule.start({ lang: 'tr-TR', interimResults: true, continuous: false })
    startPulse()
  }

  function stopRecording() { ExpoSpeechRecognitionModule.stop(); stopPulse(); setIsListening(false) }

  async function handleAnswer(text) {
    const key = STEPS[stepRef.current].key
    let finalText = text

    if (key === 'name') {
      try {
        const improved = await improveMedicineName(text)
        if (improved.isValid && improved.correctedName && improved.confidence !== 'low') {
          finalText = improved.correctedName
          if (finalText !== text) await speakText(`${finalText} olarak kaydettim.`)
        }
      } catch (e) { console.warn('improveMedicineName:', e) }
    }

    if (key === 'note' && ['hayır','geç','yok','boş','atlat','pas'].some(w => text.toLowerCase().includes(w))) {
      finalText = ''
      await speakText('Tamam, not eklenmedi.')
    } else {
      await speakText('Anladım.')
    }

    const newAnswers = { ...answersRef.current, [key]: finalText }
    answersRef.current = newAnswers
    setAnswers({ ...newAnswers })

    if (stepRef.current < STEPS.length - 1) {
      await startStep(stepRef.current + 1)
    } else {
      await saveMedicine(newAnswers)
    }
  }

  async function saveMedicine(data) {
    setSaving(true)
    await speakText('İlacınız kaydediliyor.')
    const days  = parseDays(data.days  || '')
    const times = parseTimes(data.times || '')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: savedMed, error } = await supabase.from('medicines').insert({
        user_id: user.id, name: data.name || 'İlaç', dose: data.dose || '',
        days, times, note: data.note || '',
        color: MED_COLORS[Math.floor(Math.random() * MED_COLORS.length)],
        icon:  ICONS[Math.floor(Math.random() * ICONS.length)],
      }).select().single()
      setSaving(false)
      if (error) { await speakText('Kayıt sırasında hata oluştu.'); Alert.alert('Hata', error.message); return }
      await scheduleMedicineNotifications(savedMed)
      await speakText(`${data.name || 'İlaç'} başarıyla kaydedildi!`)
      onSaved(); handleClose()
    } catch (e) {
      setSaving(false)
      await speakText('Beklenmedik bir hata oluştu.')
      Alert.alert('Hata', e.message)
    }
  }

  function handleClose() {
    ExpoSpeechRecognitionModule.stop()
    Speech.stop(); stopPulse()
    stepRef.current = 0; answersRef.current = {}
    setStep(0); setAnswers({}); setTranscript(''); setPartialText('')
    setIsListening(false); setIsSpeaking(false)
    setStarted(false); setSaving(false); setIsProcessing(false)
    onClose()
  }

  async function handleStart() {
    setStarted(true)
    await speakText('Merhaba! Size birkaç soru soracağım.')
    await startStep(0)
  }

  const progress = started ? ((step / STEPS.length) * 100) : 0

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.panel, { backgroundColor: colors.card }]}>

          {/* HEADER */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>🎙️ Sesli İlaç Ekle</Text>
            <TouchableOpacity onPress={handleClose} style={[styles.closeBtn, { backgroundColor: colors.border }]}>
              <Text style={[styles.closeText, { color: colors.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* PROGRESS */}
          {started && (
            <>
              <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={[styles.progressText, { color: colors.textMuted }]}>Adım {step + 1} / {STEPS.length}</Text>
            </>
          )}

          {/* MİKROFON */}
          <View style={styles.micArea}>
            <Animated.View style={[
              styles.micRing,
              { backgroundColor: isDark ? '#2A1A0A' : '#FDE8DA' },
              isListening   && { transform: [{ scale: pulseAnim }], backgroundColor: isDark ? '#3A2A1A' : '#FFCBA4' },
              isProcessing  && { backgroundColor: isDark ? '#1A1230' : '#EAE5F3' },
            ]}>
              <TouchableOpacity
                style={[
                  styles.micBtn,
                  isListening  && styles.micBtnActive,
                  isProcessing && styles.micBtnProcessing,
                ]}
                onPress={!started ? handleStart : isListening ? stopRecording : () => startStep(step)}
                disabled={isSpeaking || saving || isProcessing}
                activeOpacity={0.8}
              >
                <Text style={styles.micIcon}>
                  {saving ? '⏳' : isProcessing ? '🔄' : isSpeaking ? '🔊' : isListening ? '⏹️' : '🎙️'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
            <Text style={[styles.statusText, { color: colors.textMid }]}>
              {saving ? 'Kaydediliyor...' : isProcessing ? 'İşleniyor...' :
               isSpeaking ? 'Dinleyin...' : isListening ? '🔴 Sizi duyuyorum! Bitince ⏹ basın' :
               !started ? 'Başlamak için mikrofona basın' : 'Tekrar denemek için basın'}
            </Text>
          </View>

          {/* PARSİYEL METİN */}
          {partialText ? (
            <View style={[styles.partialBox, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.partialText, { color: colors.primary }]}>{partialText}...</Text>
            </View>
          ) : null}

          {/* SORU KUTUSU */}
          {started && (
            <View style={[styles.questionBox, { backgroundColor: colors.bg }]}>
              <Text style={styles.questionLabel}>❓ Soru:</Text>
              <Text style={[styles.questionText, { color: colors.text }]}>{STEPS[step]?.question}</Text>
              {transcript ? (
                <View style={[styles.transcriptBox, { backgroundColor: colors.accentSoft }]}>
                  <Text style={[styles.transcriptLabel, { color: colors.accent }]}>🎤 Duyduğum:</Text>
                  <Text style={[styles.transcriptText, { color: colors.text }]}>"{transcript}"</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* CEVAPLAR */}
          {Object.keys(answers).length > 0 && (
            <ScrollView style={[styles.answersBox, { backgroundColor: colors.successSoft }]} showsVerticalScrollIndicator={false}>
              <Text style={[styles.answersLabel, { color: '#06D6A0' }]}>✅ Kaydedilenler:</Text>
              {Object.entries(answers).map(([key, val]) => (
                <Text key={key} style={[styles.answerItem, { color: colors.text }]}>
                  • {STEPS.find(s => s.key === key)?.question.split('?')[0]}:{' '}
                  <Text style={{ fontWeight: '800' }}>{val || '—'}</Text>
                </Text>
              ))}
            </ScrollView>
          )}

          {/* DUR BUTONU */}
          {isListening && (
            <TouchableOpacity style={[styles.stopBtn, { backgroundColor: colors.text }]} onPress={stopRecording}>
              <Text style={[styles.stopBtnText, { color: colors.card }]}>⏹ Dur, Cevabı Gönder</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  panel: { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 40, minHeight: '70%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800' },
  closeBtn: { padding: 8, borderRadius: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 16, fontWeight: '700' },
  progressBar: { height: 6, borderRadius: 3, marginBottom: 6 },
  progressFill: { height: 6, backgroundColor: '#E07B4F', borderRadius: 3 },
  progressText: { fontSize: 12, fontWeight: '700', marginBottom: 20, textAlign: 'right' },
  micArea: { alignItems: 'center', marginBottom: 20 },
  micRing: { width: 110, height: 110, borderRadius: 55, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  micBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#E07B4F', alignItems: 'center', justifyContent: 'center' },
  micBtnActive: { backgroundColor: '#C96040' },
  micBtnProcessing: { backgroundColor: '#6B5B8E' },
  micIcon: { fontSize: 36 },
  statusText: { fontSize: 14, fontWeight: '600', textAlign: 'center', paddingHorizontal: 20, lineHeight: 20 },
  partialBox: { borderRadius: 12, padding: 10, marginBottom: 10, alignItems: 'center' },
  partialText: { fontSize: 14, fontStyle: 'italic' },
  questionBox: { borderRadius: 16, padding: 16, marginBottom: 16 },
  questionLabel: { fontSize: 11, fontWeight: '800', color: '#E07B4F', marginBottom: 4 },
  questionText: { fontSize: 16, fontWeight: '700', lineHeight: 24, marginBottom: 10 },
  transcriptBox: { borderRadius: 10, padding: 10 },
  transcriptLabel: { fontSize: 11, fontWeight: '800', marginBottom: 4 },
  transcriptText: { fontSize: 14, fontStyle: 'italic' },
  answersBox: { borderRadius: 16, padding: 14, marginBottom: 16, maxHeight: 130 },
  answersLabel: { fontSize: 11, fontWeight: '800', marginBottom: 6 },
  answerItem: { fontSize: 13, marginBottom: 4 },
  stopBtn: { borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 4 },
  stopBtnText: { fontSize: 15, fontWeight: '800' },
})