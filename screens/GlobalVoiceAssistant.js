import { useState, useRef, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated, Linking, Alert } from 'react-native'
import * as Speech from 'expo-speech'
import { useSpeechRecognitionEvent, ExpoSpeechRecognitionModule } from 'expo-speech-recognition'
import { processVoiceCommand } from '../lib/claudeAPI'
import { useVoice } from '../lib/VoiceContext'
import { supabase } from '../lib/supabase'

const SCREEN_MAP = {
  'Ana Sayfa':  ['ana sayfa', 'anasayfa', 'ana ekran', 'eve git', 'eve dön', 'başa dön'],
  'İlaçlarım':  ['ilaçlarım', 'ilaçlarıma', 'ilaç sayfası', 'ilaç ekranı'],
  'Sağlığım':   ['sağlığım', 'sağlığıma', 'sağlık sayfası'],
  'Ailem':      ['ailem', 'aileme', 'aile sayfası'],
  'Planlarım':  ['planlarım', 'planlarıma', 'plan sayfası', 'takvim'],
  'Profil':     ['profilim', 'profilime', 'profil sayfası', 'ayarlar'],
}

function matchNavigation(text) {
  const lower = text.toLowerCase().trim()
  const navVerbs = ['git', 'aç', 'gidelim', 'gir', 'geç', 'göster', 'bak', 'götür', 'dön']
  const hasNavVerb = navVerbs.some(v => lower.includes(v))
  for (const [screenName, keywords] of Object.entries(SCREEN_MAP)) {
    if (keywords.some(k => lower.includes(k))) {
      return { screen: screenName, confidence: hasNavVerb ? 'high' : 'medium' }
    }
  }
  return null
}

// Yerel ilaç alındı kontrolü
function matchMarkMedicine(text, medicines) {
  const lower = text.toLowerCase()
  const triggers = ['aldım', 'içtim', 'kullandım', 'alındı', 'tamam', 'içildi']
  const hasTrigger = triggers.some(t => lower.includes(t))
  if (!hasTrigger) return null
  for (const med of (medicines || [])) {
    if (lower.includes(med.name.toLowerCase())) {
      return { action: 'markMedicine', medicineName: med.name, confidence: 'high' }
    }
  }
  return null
}

// Yerel arama kontrolü
function matchCall(text, familyMembers) {
  const lower = text.toLowerCase()
  const triggers = ['ara', 'araa', 'arıyorum', 'çağır', 'telefon et', 'bağlan']
  const hasTrigger = triggers.some(t => lower.includes(t))
  if (!hasTrigger) return null
  for (const member of (familyMembers || [])) {
    if (lower.includes(member.name.toLowerCase())) {
      return { action: 'callFamily', memberName: member.name, phone: member.phone, confidence: 'high' }
    }
  }
  return null
}

export default function GlobalVoiceAssistant({ navigation, visible, onClose }) {
  const [isListening, setIsListening]   = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [partialText, setPartialText]   = useState('')
  const [transcript, setTranscript]     = useState('')
  const [response, setResponse]         = useState('')
  const [error, setError]               = useState('')
  const [pendingAction, setPendingAction] = useState(null) // onay bekleyen aksiyon
  const pulseAnim = useRef(new Animated.Value(1)).current
  const hasActed  = useRef(false)
  const { setActiveVoiceModule } = useVoice()

  // Kullanıcı verileri
  const [medicines, setMedicines]       = useState([])
  const [familyMembers, setFamilyMembers] = useState([])

  useEffect(() => {
    if (visible) {
      setActiveVoiceModule('global')
      hasActed.current = false
      loadUserData()
    } else {
      setActiveVoiceModule(null)
      ExpoSpeechRecognitionModule.stop()
      Speech.stop()
      setPendingAction(null)
    }
  }, [visible])

  async function loadUserData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [medsRes, familyRes] = await Promise.all([
      supabase.from('medicines').select('id, name, dose, days').eq('user_id', user.id),
      supabase.from('family_members').select('id, name, phone').eq('user_id', user.id),
    ])
    setMedicines(medsRes.data || [])
    setFamilyMembers(familyRes.data || [])
  }

  useSpeechRecognitionEvent('start', () => { setIsListening(true); setError('') })
  useSpeechRecognitionEvent('end',   () => { setIsListening(false); stopPulse() })
  useSpeechRecognitionEvent('error', (event) => {
    setIsListening(false); stopPulse()
    const code = String(event.error || '')
    setError(code.includes('no-speech') || code.includes('7') ? 'Ses algılanamadı, tekrar deneyin.' : 'Hata: ' + code)
  })

  useSpeechRecognitionEvent('result', async (event) => {
    if (!visible) return
    const text = event.results?.[0]?.transcript || ''
    if (event.isFinal) {
      stopPulse(); setIsListening(false)
      setTranscript(text); setPartialText('')
      if (!text.trim()) { setError('Konuşma algılanamadı, tekrar deneyin.'); return }
      setIsProcessing(true)
      try { await handleCommand(text) }
      catch (err) { setError('Hata: ' + err.message) }
      setIsProcessing(false)
    } else {
      setPartialText(text)
    }
  })

  function startPulse() {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.25, duration: 500, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 500, useNativeDriver: true }),
    ])).start()
  }

  function stopPulse() { pulseAnim.stopAnimation(); pulseAnim.setValue(1) }

  async function speak(text) {
    Speech.stop()
    return new Promise(resolve => {
      Speech.speak(text, { language: 'tr-TR', rate: 0.9, onDone: resolve, onError: resolve, onStopped: resolve })
    })
  }

  async function startListening() {
    setTranscript(''); setPartialText(''); setResponse(''); setError('')
    setPendingAction(null)
    hasActed.current = false
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync()
    if (!result.granted) { setError('Mikrofon izni verilmedi.'); return }
    ExpoSpeechRecognitionModule.start({ lang: 'tr-TR', interimResults: true, continuous: false })
    startPulse()
  }

  function stopListening() { ExpoSpeechRecognitionModule.stop(); stopPulse() }

  async function handleCommand(text) {
    const lower = text.toLowerCase()

    // 1. Navigasyon — yerel
    const navMatch = matchNavigation(text)
    if (navMatch && navMatch.confidence === 'high') {
      await doNavigate(navMatch.screen); return
    }

    // 2. İlaç alındı — yerel
    const medMatch = matchMarkMedicine(text, medicines)
    if (medMatch) {
      await doMarkMedicine(medMatch.medicineName); return
    }

    // 3. Arama — yerel
    const callMatch = matchCall(text, familyMembers)
    if (callMatch) {
      await doCallFamily(callMatch.memberName, callMatch.phone); return
    }

    // 4. Backend AI — karmaşık komutlar
    try {
      const command = await processVoiceCommand(text, medicines, familyMembers)

      switch (command.action) {
        case 'navigate':
          if (command.confidence !== 'low') {
            const screen = Object.keys(SCREEN_MAP).find(s => s === command.target || command.target?.includes(s)) || navMatch?.screen
            if (screen) { await doNavigate(screen); return }
          }
          break

        case 'markMedicine':
          if (command.medicineName) { await doMarkMedicine(command.medicineName); return }
          break

        case 'callFamily':
          if (command.memberName) { await doCallFamily(command.memberName, command.phone); return }
          break

        case 'addMedicine':
          if (command.medicineName && command.confidence !== 'low') {
            showConfirm(command.confirmMessage || `${command.medicineName} ekleyeyim mi?`, command, 'addMedicine')
            return
          }
          break

        case 'addPlan':
          if (command.title && command.confidence !== 'low') {
            showConfirm(command.confirmMessage || `${command.title} ekleyeyim mi?`, command, 'addPlan')
            return
          }
          break
      }
    } catch (e) {
      console.error('handleCommand AI error:', e)
    }

    // 5. Fallback
    setResponse('Komutu anlayamadım.')
    await speak('Komutu anlayamadım. Şu komutları deneyebilirsiniz: İlacı aldım, Birini ara, İlaç ekle veya Plan ekle.')
    setTimeout(() => handleClose(), 3000)
  }

  // ── Aksiyonlar ───────────────────────────────────────────────────────────────

  async function doNavigate(screenName) {
    const msg = `${screenName} açılıyor`
    setResponse(msg)
    try { navigation?.navigate(screenName) } catch (e) { console.error(e) }
    await speak(msg)
    setTimeout(() => handleClose(), 1500)
  }

  async function doMarkMedicine(medicineName) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const todayStr = new Date().toISOString().split('T')[0]

      // medicines tablosundan id bul
      const med = medicines.find(m => m.name.toLowerCase() === medicineName.toLowerCase())
        || medicines.find(m => medicineName.toLowerCase().includes(m.name.toLowerCase()))

      if (!med) {
        setResponse(`${medicineName} ilaçlarınızda bulunamadı.`)
        await speak(`${medicineName} ilaçlarınızda bulunamadı.`)
        setTimeout(() => handleClose(), 2000)
        return
      }

      // medicine_logs tablosuna kayıt
      await supabase.from('medicine_logs').upsert({
        user_id: user.id,
        medicine_id: med.id,
        taken_date: todayStr,
        taken_at: new Date().toISOString(),
      }, { onConflict: 'user_id,medicine_id,taken_date' })

      const msg = `${med.name} alındı olarak işaretlendi ✓`
      setResponse(msg)
      await speak(`${med.name} alındı olarak işaretlendi.`)
      setTimeout(() => handleClose(), 2000)
    } catch (e) {
      console.error('doMarkMedicine error:', e)
      setError('İşaretleme sırasında hata oluştu.')
    }
  }

  async function doCallFamily(memberName, phone) {
    if (!phone) {
      const msg = `${memberName}'in telefon numarası kayıtlı değil.`
      setResponse(msg)
      await speak(msg)
      setTimeout(() => handleClose(), 2500)
      return
    }

    const msg = `${memberName} aranıyor...`
    setResponse(msg)
    await speak(`${memberName} arıyorum.`)

    const phoneUrl = `tel:${phone.replace(/\s/g, '')}`
    try {
      const canOpen = await Linking.canOpenURL(phoneUrl)
      if (canOpen) {
        await Linking.openURL(phoneUrl)
      } else {
        setError('Telefon uygulaması açılamadı.')
      }
    } catch (e) {
      setError('Arama başlatılamadı.')
    }
    setTimeout(() => handleClose(), 1500)
  }

  async function doAddMedicine(command) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('medicines').insert({
        user_id: user.id,
        name: command.medicineName,
        dose: command.dose || '',
        days: command.days || ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'],
        times: command.times || ['08:00'],
        note: command.note || '',
      })
      const msg = `${command.medicineName} ilaçlarınıza eklendi.`
      setResponse(msg)
      await speak(msg)
      setTimeout(() => handleClose(), 2000)
    } catch (e) {
      console.error('doAddMedicine error:', e)
      setError('İlaç eklenirken hata oluştu.')
    }
  }

  async function doAddPlan(command) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('plans').insert({
        user_id: user.id,
        title: command.title,
        plan_date: command.date,
        plan_time: command.time || '09:00',
        note: command.note || '',
      })
      const msg = `${command.title} planlarınıza eklendi.`
      setResponse(msg)
      await speak(msg)
      setTimeout(() => handleClose(), 2000)
    } catch (e) {
      console.error('doAddPlan error:', e)
      setError('Plan eklenirken hata oluştu.')
    }
  }

  // ── Onay sistemi ─────────────────────────────────────────────────────────────
  function showConfirm(message, actionData, actionType) {
    setPendingAction({ message, actionData, actionType })
    setResponse(message)
    speak(message + '. Onaylıyor musunuz?')
  }

  async function confirmAction() {
    if (!pendingAction) return
    setPendingAction(null)
    setResponse('İşlem yapılıyor...')
    if (pendingAction.actionType === 'addMedicine') {
      await doAddMedicine(pendingAction.actionData)
    } else if (pendingAction.actionType === 'addPlan') {
      await doAddPlan(pendingAction.actionData)
    }
  }

  function cancelAction() {
    setPendingAction(null)
    setResponse('İptal edildi.')
    speak('İptal edildi.')
    setTimeout(() => handleClose(), 1500)
  }

  function handleClose() {
    ExpoSpeechRecognitionModule.stop()
    Speech.stop(); stopPulse()
    setTranscript(''); setPartialText(''); setResponse(''); setError('')
    setIsListening(false); setIsProcessing(false)
    setPendingAction(null)
    hasActed.current = false
    onClose()
  }

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.panel}>
          <Text style={styles.title}>🎙️ Sesli Asistan</Text>
          <Text style={styles.hint}>
            "Aspirini aldım" · "Annemi ara" · "Yarın doktor ekle" · "İlaçlarıma git"
          </Text>

          {/* Mikrofon */}
          {!pendingAction && (
            <>
              <Animated.View style={[
                styles.micRing,
                isListening  && { transform: [{ scale: pulseAnim }] },
                isListening  && styles.micRingActive,
                isProcessing && styles.micRingProcessing,
              ]}>
                <TouchableOpacity
                  style={[styles.micBtn, isListening && styles.micBtnActive, isProcessing && styles.micBtnProcessing]}
                  onPress={isListening ? stopListening : startListening}
                  disabled={isProcessing}
                  activeOpacity={0.8}
                >
                  <Text style={styles.micIcon}>
                    {isProcessing ? '🔄' : isListening ? '⏹️' : '🎙️'}
                  </Text>
                </TouchableOpacity>
              </Animated.View>

              <Text style={styles.statusText}>
                {isProcessing ? '⏳ Komut analiz ediliyor...' :
                 isListening  ? '🔴 Dinliyorum — konuşun!' : 'Mikrofona basarak konuşun'}
              </Text>
            </>
          )}

          {partialText ? <View style={styles.partialBox}><Text style={styles.partialText}>{partialText}...</Text></View> : null}
          {transcript  ? <View style={styles.transcriptBox}><Text style={styles.transcriptLabel}>🎤 Duyduğum:</Text><Text style={styles.transcriptText}>"{transcript}"</Text></View> : null}
          {response    ? <View style={styles.responseBox}><Text style={styles.responseText}>✅ {response}</Text></View> : null}
          {error       ? <View style={styles.errorBox}><Text style={styles.errorText}>⚠️ {error}</Text></View> : null}

          {/* Onay butonları */}
          {pendingAction && (
            <View style={styles.confirmArea}>
              <Text style={styles.confirmText}>🤔 {pendingAction.message}</Text>
              <View style={styles.confirmBtns}>
                <TouchableOpacity style={styles.confirmYes} onPress={confirmAction}>
                  <Text style={styles.confirmYesText}>✅ Evet, Ekle</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmNo} onPress={cancelAction}>
                  <Text style={styles.confirmNoText}>❌ İptal</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Komut örnekleri */}
          {!isListening && !isProcessing && !pendingAction && !transcript && (
            <View style={styles.examplesBox}>
              <Text style={styles.examplesTitle}>Örnek komutlar:</Text>
              <Text style={styles.exampleItem}>💊 "Aspirini aldım"</Text>
              <Text style={styles.exampleItem}>📞 "Annemi ara"</Text>
              <Text style={styles.exampleItem}>💊 "Aspirin 500mg ekle, her gün sabah akşam"</Text>
              <Text style={styles.exampleItem}>📅 "Yarın saat 3'e doktor randevusu ekle"</Text>
              <Text style={styles.exampleItem}>🏠 "Ana sayfaya git"</Text>
            </View>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <Text style={styles.closeBtnText}>Kapat</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  panel: { backgroundColor: 'white', borderRadius: 28, padding: 24, width: '100%', maxWidth: 400, elevation: 12 },
  title: { fontSize: 20, fontWeight: '800', color: '#2C2C3A', textAlign: 'center', marginBottom: 6 },
  hint: { fontSize: 11, color: '#9BA3CC', textAlign: 'center', marginBottom: 20, lineHeight: 17 },

  micRing: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#EEF1FF', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  micRingActive: { backgroundColor: '#FFE4D6' },
  micRingProcessing: { backgroundColor: '#EAE5F3' },
  micBtn: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#4361EE', alignItems: 'center', justifyContent: 'center' },
  micBtnActive: { backgroundColor: '#E05050' },
  micBtnProcessing: { backgroundColor: '#6B5B8E' },
  micIcon: { fontSize: 34 },
  statusText: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 16, fontWeight: '600', lineHeight: 20 },

  partialBox: { backgroundColor: '#F5F5FF', borderRadius: 12, padding: 10, marginBottom: 10, alignItems: 'center' },
  partialText: { fontSize: 14, color: '#9BA3CC', fontStyle: 'italic' },
  transcriptBox: { backgroundColor: '#EEF1FF', borderRadius: 14, padding: 14, marginBottom: 12 },
  transcriptLabel: { fontSize: 11, fontWeight: '800', color: '#4361EE', marginBottom: 4 },
  transcriptText: { fontSize: 14, color: '#2C2C3A', fontStyle: 'italic', lineHeight: 20 },
  responseBox: { backgroundColor: '#E8F7EF', borderRadius: 14, padding: 14, marginBottom: 12 },
  responseText: { fontSize: 14, fontWeight: '700', color: '#2C6E49', textAlign: 'center' },
  errorBox: { backgroundColor: '#FFF0F0', borderRadius: 14, padding: 14, marginBottom: 12 },
  errorText: { fontSize: 13, color: '#C0392B', textAlign: 'center' },

  confirmArea: { backgroundColor: '#FFF8E1', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 2, borderColor: '#F0A500' },
  confirmText: { fontSize: 14, fontWeight: '700', color: '#2C2C3A', textAlign: 'center', marginBottom: 14, lineHeight: 20 },
  confirmBtns: { flexDirection: 'row', gap: 10 },
  confirmYes: { flex: 1, backgroundColor: '#06D6A0', borderRadius: 12, padding: 14, alignItems: 'center' },
  confirmYesText: { fontSize: 14, fontWeight: '800', color: 'white' },
  confirmNo: { flex: 1, backgroundColor: '#FFF0F0', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#E05050' },
  confirmNoText: { fontSize: 14, fontWeight: '800', color: '#E05050' },

  examplesBox: { backgroundColor: '#F8F8FF', borderRadius: 14, padding: 14, marginBottom: 12 },
  examplesTitle: { fontSize: 12, fontWeight: '800', color: '#4361EE', marginBottom: 8 },
  exampleItem: { fontSize: 12, color: '#555', marginBottom: 4, lineHeight: 18 },

  closeBtn: { backgroundColor: '#F0F0F5', borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 4 },
  closeBtnText: { fontSize: 15, fontWeight: '700', color: '#666' },
})