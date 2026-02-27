/**
 * E-Baston — Global Sesli Okuma Sistemi
 * 
 * Kurulum:
 *   1. Bu dosyayı lib/SpeechContext.js olarak kaydedin
 *   2. App.js'i aşağıdaki gibi güncelleyin (App.js de ayrıca verildi)
 *   3. SpeakablePress bileşenini istediğiniz yerde kullanın
 * 
 * Kullanım:
 *   import { SpeakablePress, useSpeech } from '../lib/SpeechContext'
 * 
 *   // Buton/kart yerine:
 *   <SpeakablePress text="İlaç ekle butonu" onPress={handlePress}>
 *     <View>...</View>
 *   </SpeakablePress>
 */

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { TouchableOpacity, View, StyleSheet, Text, Animated } from 'react-native'
import * as Speech from 'expo-speech'
import AsyncStorage from '@react-native-async-storage/async-storage'

const SpeechContext = createContext(null)
const STORAGE_KEY = 'ebaston_speech_enabled'

// ── Provider — App.js'i sarar ────────────────────────────────────────────────
export function SpeechProvider({ children }) {
  const [enabled, setEnabled] = useState(false)
  const [speaking, setSpeaking] = useState(false)

  // AsyncStorage'dan ayarı yükle
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(val => {
      if (val === 'true') setEnabled(true)
    })
  }, [])

  const toggle = useCallback(async () => {
    const next = !enabled
    setEnabled(next)
    await AsyncStorage.setItem(STORAGE_KEY, String(next))
    if (next) {
      speak('Sesli okuma açıldı')
    } else {
      Speech.stop()
      setSpeaking(false)
    }
  }, [enabled])

  const speak = useCallback((text) => {
    if (!text) return
    Speech.stop()
    setSpeaking(true)
    Speech.speak(text, {
      language: 'tr-TR',
      rate: 0.85,
      pitch: 1.0,
      onDone: () => setSpeaking(false),
      onError: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
    })
  }, [])

  const stop = useCallback(() => {
    Speech.stop()
    setSpeaking(false)
  }, [])

  return (
    <SpeechContext.Provider value={{ enabled, toggle, speak, stop, speaking }}>
      {children}
    </SpeechContext.Provider>
  )
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useSpeech() {
  const ctx = useContext(SpeechContext)
  if (!ctx) throw new Error('useSpeech must be used within SpeechProvider')
  return ctx
}

// ── SpeakablePress — TouchableOpacity yerine kullanılır ──────────────────────
/**
 * Sesli okuma açıkken basıldığında `text` parametresini okur,
 * sonra normal `onPress` işlemi çalışır.
 * 
 * @param {string}   text       Okunacak metin
 * @param {function} onPress    Normal tıklama aksiyonu
 * @param {object}   style      TouchableOpacity stili
 * @param {number}   activeOpacity
 * @param {boolean}  speakOnly  true ise onPress çalışmaz, sadece okur
 */
export function SpeakablePress({
  text,
  onPress,
  children,
  style,
  activeOpacity = 0.75,
  speakOnly = false,
  disabled = false,
}) {
  const { enabled, speak } = useSpeech()

  function handlePress() {
    if (enabled && text) {
      speak(text)
    }
    if (!speakOnly && onPress) {
      // Sesli okuma açıksa küçük bir gecikme ile aksiyonu çalıştır
      // böylece kullanıcı neye bastığını duyar
      if (enabled && text) {
        setTimeout(() => onPress(), 400)
      } else {
        onPress()
      }
    }
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={style}
      activeOpacity={activeOpacity}
      disabled={disabled}
    >
      {children}
    </TouchableOpacity>
  )
}

// ── SpeechToggleButton — Tab bar veya header'a eklenecek buton ───────────────
/**
 * Sesli okumayı açıp kapatan yüzen buton.
 * HomeScreen veya her ekranın köşesine eklenebilir.
 */
export function SpeechToggleButton({ style }) {
  const { enabled, toggle, speaking } = useSpeech()

  return (
    <TouchableOpacity
      onPress={toggle}
      style={[styles.floatingBtn, enabled && styles.floatingBtnActive, style]}
      activeOpacity={0.8}
    >
      <Text style={styles.floatingIcon}>
        {speaking ? '🔊' : enabled ? '🔈' : '🔇'}
      </Text>
      <Text style={[styles.floatingLabel, enabled && styles.floatingLabelActive]}>
        {enabled ? 'Ses Açık' : 'Ses Kapalı'}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  floatingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F4FF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: '#E2E8FF',
  },
  floatingBtnActive: {
    backgroundColor: '#4361EE',
    borderColor: '#3451D1',
  },
  floatingIcon: {
    fontSize: 16,
  },
  floatingLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9BA3CC',
  },
  floatingLabelActive: {
    color: 'white',
  },
})