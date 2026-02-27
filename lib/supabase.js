import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl
const supabaseKey = Constants.expoConfig?.extra?.supabaseKey

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '[E-Baston] Supabase bilgileri eksik!\n' +
    '.env dosyasında SUPABASE_URL ve SUPABASE_ANON_KEY tanımlandığından emin olun.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})