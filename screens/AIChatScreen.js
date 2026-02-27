import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Animated, ActivityIndicator, Keyboard
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Speech from 'expo-speech'
import { supabase } from '../lib/supabase'
import { sendHealthChatMessage } from '../lib/claudeAPI'
import { FONTS, RADIUS, SHADOW } from '../lib/theme'
import { useTheme } from '../lib/ThemeContext'
import { SpeechToggleButton } from '../lib/SpeechContext'
import ChatMessage from '../components/ChatMessage'

const QUICK_QUESTIONS = [
  { emoji: '💊', text: 'İlaçlarımı ne zaman almalıyım?' },
  { emoji: '🩺', text: 'Tansiyon değerlerim normal mi?' },
  { emoji: '🥗', text: 'Sağlıklı beslenme önerilerin neler?' },
  { emoji: '💤', text: 'Uyku düzeni için öneriler' },
  { emoji: '🏃', text: 'Hangi egzersizleri yapmalıyım?' },
  { emoji: '💊', text: 'İlaç yan etkileri hakkında bilgi' },
]

function TypingIndicator({ colors }) {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current]
  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 150),
        Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]))
    )
    Animated.parallel(animations).start()
    return () => animations.forEach(a => a.stop())
  }, [])
  return (
    <View style={{ flexDirection: 'row', gap: 4, padding: 8, alignItems: 'center' }}>
      {dots.map((dot, i) => (
        <Animated.View key={i} style={{
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: colors.primary,
          opacity: dot,
          transform: [{ scale: dot.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }]
        }} />
      ))}
    </View>
  )
}

const WELCOME_MSG = {
  id: 'welcome',
  role: 'assistant',
  content: 'Merhaba! Ben CanBakım AI asistanınım. 👋\n\nSağlık, ilaçlar, beslenme veya yaşam tarzı hakkında sorularınızı yanıtlayabilirim.\n\n⚠️ Önemli: Ben bir yapay zekayım ve tıbbi teşhis koyamam. Ciddi sağlık sorunları için lütfen doktorunuza başvurun.',
  time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
}

export default function AIChatScreen() {
  const [messages, setMessages]       = useState([WELCOME_MSG])
  const [input, setInput]             = useState('')
  const [isLoading, setIsLoading]     = useState(false)
  const [userContext, setUserContext]  = useState({})
  const [isSpeaking, setIsSpeaking]   = useState(false)
  const [speakingId, setSpeakingId]   = useState(null)
  const flatListRef = useRef(null)
  const { colors } = useTheme()

  useEffect(() => { loadUserContext() }, [])

  // Klavye açılınca en alta scroll yap
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150)
    })
    return () => show.remove()
  }, [])

  async function loadUserContext() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [medsRes, healthRes] = await Promise.all([
      supabase.from('medicines').select('name,dose,days').eq('user_id', user.id).limit(10),
      supabase.from('health_records').select('*').eq('user_id', user.id).order('recorded_at', { ascending: false }).limit(3),
    ])
    setUserContext({ medicines: medsRes.data || [], healthRecords: healthRes.data || [] })
  }

  async function sendMessage(text = input.trim()) {
    if (!text || isLoading) return
    setInput('')

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    // Aşağı kaydır
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)

    try {
      const apiMessages = [...messages.filter(m => m.id !== 'welcome'), userMsg]
        .map(m => ({ role: m.role, content: m.content }))

      const response = await sendHealthChatMessage(apiMessages, userContext)

      const assistantMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '⚠️ Bağlantı hatası oluştu. İnternet bağlantınızı kontrol edip tekrar deneyin.',
        time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      }])
    }

    setIsLoading(false)
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)
  }

  // useCallback — her render'da yeni fonksiyon oluşturmayı önler
  const speakMessage = useCallback((msgId, text) => {
    if (speakingId === msgId) {
      Speech.stop()
      setIsSpeaking(false)
      setSpeakingId(null)
      return
    }
    Speech.stop()
    setIsSpeaking(true)
    setSpeakingId(msgId)
    Speech.speak(text, {
      language: 'tr-TR', rate: 0.85,
      onDone: () => { setIsSpeaking(false); setSpeakingId(null) },
      onError: () => { setIsSpeaking(false); setSpeakingId(null) },
      onStopped: () => { setIsSpeaking(false); setSpeakingId(null) },
    })
  }, [speakingId])

  function clearChat() {
    Speech.stop()
    setIsSpeaking(false); setSpeakingId(null)
    setMessages([{ ...WELCOME_MSG, content: 'Sohbet temizlendi. Yeni bir şey sormak ister misiniz? 😊', time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) }])
  }

  // Styles en başta tanımla — ListHeader/ListFooter kullanabilsin
  const s = useMemo(() => makeStyles(colors), [colors])

  // FlatList renderItem — useCallback ile memoize
  const renderItem = useCallback(({ item }) => (
    <ChatMessage
      msg={item}
      colors={colors}
      isSpeaking={speakingId === item.id}
      onSpeak={(text) => speakMessage(item.id, text)}
    />
  ), [colors, speakingId, speakMessage])

  // keyExtractor — stabil fonksiyon
  const keyExtractor = useCallback((item) => item.id, [])

  // Hızlı sorular başlığı (ListHeaderComponent)
  const ListHeader = useMemo(() => {
    if (messages.length > 1) return null
    return (
      <View style={s.quickSection}>
        <Text style={[s.quickTitle, { color: colors.textMuted }]}>Hızlı Sorular</Text>
        <View style={s.quickGrid}>
          {QUICK_QUESTIONS.map((q, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => sendMessage(q.text)}
              style={[s.quickBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              activeOpacity={0.75}
            >
              <Text style={{ fontSize: 16 }}>{q.emoji}</Text>
              <Text style={[s.quickBtnText, { color: colors.textMid }]}>{q.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    )
  }, [messages.length, colors, s])

  // Yazıyor göstergesi (ListFooterComponent)
  const ListFooter = useMemo(() => {
    if (!isLoading) return <View style={{ height: 20 }} />
    return (
      <View style={[s.messageBubbleWrap, s.aiBubbleWrap]}>
        <View style={s.aiAvatarSmall}>
          <Text style={{ fontSize: 14 }}>🤖</Text>
        </View>
        <View style={[s.bubble, s.aiBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TypingIndicator colors={colors} />
        </View>
      </View>
    )
  }, [isLoading, colors, s])

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* HEADER */}
      <LinearGradient colors={['#4361EE', '#7209B7']} style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.aiAvatar}>
            <Text style={{ fontSize: 24 }}>🤖</Text>
          </View>
          <View>
            <Text style={s.headerTitle}>AI Sağlık Asistanı</Text>
            <Text style={s.headerSub}>{isLoading ? '⏳ Yanıt hazırlanıyor...' : '🟢 Çevrimiçi'}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <SpeechToggleButton />
          <TouchableOpacity onPress={clearChat} style={s.clearBtn}>
            <Text style={{ fontSize: 18 }}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* MESAJLAR — FlatList ile virtualize edildi */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        contentContainerStyle={s.messageContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        removeClippedSubviews={true}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={10}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 100 }}
      />

      {/* GİRDİ ALANI */}
      <View style={[s.inputArea, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TextInput
          style={[s.textInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
          placeholder="Sağlık sorunuzu yazın..."
          placeholderTextColor={colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          onSubmitEditing={() => sendMessage()}
          returnKeyType="send"
          blurOnSubmit={false}
        />
        <TouchableOpacity
          onPress={() => sendMessage()}
          disabled={!input.trim() || isLoading}
          style={[s.sendBtn, { backgroundColor: colors.primary }, (!input.trim() || isLoading) && { opacity: 0.5 }]}
          activeOpacity={0.8}
        >
          {isLoading
            ? <ActivityIndicator size="small" color="white" />
            : <Text style={{ fontSize: 20 }}>➤</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const makeStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingTop: 16, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONTS.md, fontWeight: '800', color: 'white' },
  headerSub: { fontSize: FONTS.xs, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  clearBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  messageContent: { padding: 16, paddingBottom: 8 },
  quickSection: { marginBottom: 20 },
  quickTitle: { fontSize: FONTS.xs, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, ...SHADOW.sm },
  quickBtnText: { fontSize: FONTS.xs, fontWeight: '600', flexShrink: 1 },
  messageBubbleWrap: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  aiBubbleWrap: { justifyContent: 'flex-start', alignItems: 'flex-end' },
  aiAvatarSmall: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#4361EE20', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end', marginBottom: 16 },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5, ...SHADOW.sm },
  aiBubble: { borderBottomLeftRadius: 4 },
  inputArea: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, borderTopWidth: 1, gap: 8 },
  textInput: { flex: 1, borderRadius: 22, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 10, fontSize: FONTS.sm, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', ...SHADOW.sm },
})