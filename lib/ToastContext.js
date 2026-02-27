/**
 * E-Baston — Toast & Global Error Handler
 *
 * Kullanım:
 *   import { useToast } from '../lib/ToastContext'
 *   const { toast } = useToast()
 *   toast.success('İlaç kaydedildi!')
 *   toast.error('Bir hata oluştu')
 *   toast.info('Bilgi mesajı')
 *   toast.warning('Uyarı')
 */

import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native'
import { FONTS, RADIUS, SHADOW } from './theme'

const ToastContext = createContext(null)

const TOAST_TYPES = {
  success: { icon: '✅', bg: '#06D6A0', text: 'white' },
  error:   { icon: '❌', bg: '#EF233C', text: 'white' },
  warning: { icon: '⚠️', bg: '#F0A500', text: 'white' },
  info:    { icon: 'ℹ️', bg: '#4361EE', text: 'white' },
}

const DURATION = 3000

function ToastItem({ item, onHide }) {
  const anim = useRef(new Animated.Value(0)).current
  const type = TOAST_TYPES[item.type] || TOAST_TYPES.info

  // useEffect ile animasyonu başlat — render sırasında yan etki yok
  useEffect(() => {
    Animated.sequence([
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.delay(DURATION - 400),
      Animated.timing(anim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => onHide(item.id))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={[
      styles.toast,
      { backgroundColor: type.bg },
      {
        opacity: anim,
        transform: [{
          translateY: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [-20, 0],
          })
        }]
      }
    ]}>
      <Text style={styles.toastIcon}>{type.icon}</Text>
      <Text style={[styles.toastText, { color: type.text }]} numberOfLines={3}>
        {item.message}
      </Text>
      <TouchableOpacity onPress={() => onHide(item.id)} style={styles.closeBtn}>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: '700' }}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const hide = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const show = useCallback((message, type = 'info') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`
    setToasts(prev => [...prev.slice(-2), { id, message, type }])
  }, [])

  const toast = {
    success: (msg) => show(msg, 'success'),
    error:   (msg) => show(msg, 'error'),
    warning: (msg) => show(msg, 'warning'),
    info:    (msg) => show(msg, 'info'),
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <View style={styles.container} pointerEvents="box-none">
        {toasts.map(item => (
          <ToastItem key={item.id} item={item} onHide={hide} />
        ))}
      </View>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

/**
 * Global JS hata yakalayıcı — App.js içinde bir kez çağırın
 * setupGlobalErrorHandler(toast)
 */
export function setupGlobalErrorHandler(toast) {
  if (global.__globalErrorHandlerSet) return
  global.__globalErrorHandlerSet = true

  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error('[Global Error]', error)
    if (isFatal) {
      toast.error('Kritik hata oluştu. Uygulamayı yeniden başlatın.')
    } else {
      toast.error(error?.message || 'Beklenmedik bir hata oluştu.')
    }
  })
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    ...SHADOW.lg,
  },
  toastIcon: { fontSize: 18 },
  toastText: {
    flex: 1,
    fontSize: FONTS.sm,
    fontWeight: '600',
    lineHeight: 20,
  },
  closeBtn: { padding: 4 },
})