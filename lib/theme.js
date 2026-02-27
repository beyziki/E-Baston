import { Dimensions } from 'react-native'

export const { width: SCREEN_WIDTH } = Dimensions.get('window')

export const COLORS = {
  // Ana renkler — Mavi & Mor tonları
  primary: '#4361EE',
  primaryDark: '#3451D1',
  primaryLight: '#6B84F3',
  primarySoft: '#EDF0FF',

  secondary: '#4CC9F0',
  secondaryDark: '#2BB5E0',
  secondarySoft: '#E8F9FF',

  accent: '#7209B7',
  accentSoft: '#F3E8FF',

  success: '#06D6A0',
  successSoft: '#E6FBF5',
  warning: '#F72585',
  warningSoft: '#FEE8F3',
  danger: '#EF233C',
  dangerSoft: '#FDEAED',
  info: '#3A86FF',
  infoSoft: '#E8F1FF',

  // Nötr
  bg: '#F0F4FF',
  card: '#FFFFFF',
  border: '#E2E8FF',
  text: '#0D1B4B',
  textMid: '#4A5580',
  textMuted: '#9BA3CC',

  white: '#FFFFFF',
  black: '#000000',
}

export const GRADIENTS = {
  primary: ['#4361EE', '#4CC9F0'],
  secondary: ['#4CC9F0', '#7209B7'],
  accent: ['#7209B7', '#F72585'],
  success: ['#06D6A0', '#4CC9F0'],
  dark: ['#0D1B4B', '#1A2980'],
  warm: ['#F72585', '#7209B7'],
  cool: ['#4361EE', '#4CC9F0'],
  hero: ['#4361EE', '#7209B7', '#4CC9F0'],
}

export const FONTS = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 36,
}

export const RADIUS = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  full: 999,
}

export const SHADOW = {
  sm: {
    shadowColor: '#4361EE',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#4361EE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#4361EE',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8,
  },
  colored: (color) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  }),
}