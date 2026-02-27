/**
 * E-Baston — Dark / Light Mode Sistemi
 * 
 * Kullanım:
 *   import { useTheme, ThemeToggleButton } from '../lib/ThemeContext'
 *   const { colors, isDark, toggleTheme } = useTheme()
 */

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const THEME_KEY = 'ebaston_theme'

// ── Renk Paletleri ───────────────────────────────────────────────────────────
const LIGHT_COLORS = {
  primary: '#4361EE',
  primaryDark: '#3451D1',
  primaryLight: '#6B84F3',
  primarySoft: '#EDF0FF',
  secondary: '#4CC9F0',
  accent: '#7209B7',
  accentSoft: '#F3E8FF',
  success: '#06D6A0',
  successSoft: '#E6FBF5',
  warning: '#F72585',
  danger: '#EF233C',
  dangerSoft: '#FDEAED',
  info: '#3A86FF',
  infoSoft: '#E8F1FF',
  bg: '#F0F4FF',
  card: '#FFFFFF',
  border: '#E2E8FF',
  text: '#0D1B4B',
  textMid: '#4A5580',
  textMuted: '#9BA3CC',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.5)',
  inputBg: '#F0F4FF',
}

const DARK_COLORS = {
  primary: '#5B7BFF',
  primaryDark: '#4361EE',
  primaryLight: '#7B94FF',
  primarySoft: '#1A2356',
  secondary: '#4CC9F0',
  accent: '#9B3FD4',
  accentSoft: '#2A1245',
  success: '#06D6A0',
  successSoft: '#0A2E25',
  warning: '#F72585',
  danger: '#EF233C',
  dangerSoft: '#2E0A10',
  info: '#3A86FF',
  infoSoft: '#0A1A35',
  bg: '#0D1117',
  card: '#161B22',
  border: '#21262D',
  text: '#E6EDF3',
  textMid: '#8B949E',
  textMuted: '#484F58',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.75)',
  inputBg: '#0D1117',
}

// ── Context ──────────────────────────────────────────────────────────────────
const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(val => {
      if (val === 'dark') setIsDark(true)
    })
  }, [])

  const toggleTheme = useCallback(async () => {
    const next = !isDark
    setIsDark(next)
    await AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light')
  }, [isDark])

  const colors = isDark ? DARK_COLORS : LIGHT_COLORS

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

// ── ThemeToggleButton ────────────────────────────────────────────────────────
export function ThemeToggleButton({ style }) {
  const { isDark, toggleTheme } = useTheme()
  return (
    <TouchableOpacity
      onPress={toggleTheme}
      style={[styles.btn, isDark && styles.btnDark, style]}
      activeOpacity={0.8}
    >
      <Text style={styles.icon}>{isDark ? '☀️' : '🌙'}</Text>
      <Text style={[styles.label, isDark && styles.labelDark]}>
        {isDark ? 'Aydınlık' : 'Karanlık'}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EDF0FF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: '#E2E8FF',
  },
  btnDark: {
    backgroundColor: '#21262D',
    borderColor: '#30363D',
  },
  icon: { fontSize: 16 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9BA3CC',
  },
  labelDark: {
    color: '#8B949E',
  },
})