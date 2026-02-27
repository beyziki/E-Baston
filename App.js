import { useState, useEffect, useRef } from 'react'
import { StyleSheet, TouchableOpacity, Text, View, ActivityIndicator } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'

import GlobalVoiceAssistant from './screens/GlobalVoiceAssistant'
import LoginScreen from './screens/LoginScreen'
import HomeScreen from './screens/HomeScreen'
import MedicinesScreen from './screens/MedicinesScreen'
import FamilyScreen from './screens/FamilyScreen'
import HealthScreen from './screens/HealthScreen'
import PlanningScreen from './screens/PlanningScreen'
import ProfileScreen from './screens/ProfileScreen'
import StatsScreen from './screens/StatsScreen'
import AIChatScreen from './screens/AIChatScreen'
import { COLORS, SHADOW } from './lib/theme'
import { setupNotifications } from './lib/notifications'
import { SpeechProvider } from './lib/SpeechContext'
import { VoiceProvider, useVoice } from './lib/VoiceContext'
import { ThemeProvider, useTheme } from './lib/ThemeContext'
import { ToastProvider, setupGlobalErrorHandler, useToast } from './lib/ToastContext'
import { supabase } from './lib/supabase'

const Tab = createBottomTabNavigator()

// Global hata yakalayıcıyı Toast ile bağlar
function GlobalErrorHandler() {
  const { toast } = useToast()
  useEffect(() => { setupGlobalErrorHandler(toast) }, [])
  return null
}

function MainApp() {
  const [showVoiceAssistant, setShowVoiceAssistant] = useState(false)
  const navigationRef = useRef(null)
  const { activeVoiceModule } = useVoice()
  const { colors } = useTheme()

  const fabVisible = activeVoiceModule !== 'medicine'

  function handleOpenGlobal() {
    if (activeVoiceModule && activeVoiceModule !== 'global') return
    setShowVoiceAssistant(true)
  }

  return (
    <>
      <NavigationContainer ref={navigationRef}>
        <Tab.Navigator
          screenOptions={{
            tabBarStyle: {
              backgroundColor: colors.card,
              borderTopWidth: 0,
              height: 70,
              paddingBottom: 10,
              paddingTop: 8,
              ...SHADOW.lg,
            },
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
            headerStyle: { backgroundColor: colors.primary, elevation: 0, shadowOpacity: 0 },
            headerTintColor: '#FFF',
            headerTitleStyle: { fontWeight: '800', fontSize: 18 },
          }}
        >
          <Tab.Screen name="Ana Sayfa"  component={HomeScreen}      options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>🏠</Text> }} />
          <Tab.Screen name="İlaçlarım"  component={MedicinesScreen} options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>💊</Text> }} />
          <Tab.Screen name="Sağlığım"   component={HealthScreen}    options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>❤️</Text> }} />
          <Tab.Screen name="Ailem"      component={FamilyScreen}    options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>👨‍👩‍👧</Text> }} />
          <Tab.Screen name="Planlarım"  component={PlanningScreen}  options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>📅</Text> }} />
          <Tab.Screen name="İstatistik" component={StatsScreen}     options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>📊</Text> }} />
          <Tab.Screen name="AI Asistan" component={AIChatScreen}    options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>🤖</Text> }} />
          <Tab.Screen name="Profil"     component={ProfileScreen}   options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>👤</Text> }} />
        </Tab.Navigator>
      </NavigationContainer>

      {fabVisible && (
        <TouchableOpacity style={styles.voiceFab} onPress={handleOpenGlobal}>
          <Text style={{ fontSize: 28 }}>🎙️</Text>
        </TouchableOpacity>
      )}

      <GlobalVoiceAssistant
        navigation={navigationRef.current}
        visible={showVoiceAssistant}
        onClose={() => setShowVoiceAssistant(false)}
      />
    </>
  )
}

function AuthWrapper() {
  const [authState, setAuthState] = useState('loading')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState(session ? 'logged_in' : 'logged_out')
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthState(session ? 'logged_in' : 'logged_out')
    })
    return () => subscription.unsubscribe()
  }, [])

  if (authState === 'loading') {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.loadingLogo}>🦯 E-Baston</Text>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
      </View>
    )
  }

  if (authState === 'logged_out') {
    return <LoginScreen onLogin={() => {}} />
  }

  return <MainApp />
}

export default function App() {
  useEffect(() => { setupNotifications() }, [])

  return (
    <ThemeProvider>
      <ToastProvider>
        <GlobalErrorHandler />
        <SpeechProvider>
          <VoiceProvider>
            <AuthWrapper />
          </VoiceProvider>
        </SpeechProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}

const styles = StyleSheet.create({
  voiceFab: {
    position: 'absolute',
    bottom: 90, right: 20,
    width: 60, height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogo: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.primary,
  },
})