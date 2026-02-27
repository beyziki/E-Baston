/**
 * E-Baston — Medicine Service
 * markTaken, fetchTakenIds gibi ilaç işlemlerini tek yerden yönetir.
 * HomeScreen ve MedicinesScreen bu servisi kullanır.
 */

import { supabase } from './supabase'

const todayStr = () => new Date().toISOString().split('T')[0]

// ── İlacı alındı olarak işaretle (DB + optimistic) ───────────────────────────
/**
 * @param {string} userId
 * @param {string} medicineId
 * @returns {{ success: boolean, error?: string }}
 */
export async function markMedicineTaken(userId, medicineId) {
  const { error } = await supabase.from('medicine_taken_logs').upsert(
    {
      user_id: userId,
      medicine_id: medicineId,
      taken_date: todayStr(),
      taken_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,medicine_id,taken_date' }
  )

  if (error) {
    console.error('[medicineService] markMedicineTaken error:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// ── İlacı alınmadı olarak geri al ────────────────────────────────────────────
export async function unmarkMedicineTaken(userId, medicineId) {
  const { error } = await supabase
    .from('medicine_taken_logs')
    .delete()
    .eq('user_id', userId)
    .eq('medicine_id', medicineId)
    .eq('taken_date', todayStr())

  if (error) {
    console.error('[medicineService] unmarkMedicineTaken error:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// ── Bugün alınan ilaç ID'lerini getir ────────────────────────────────────────
export async function fetchTakenIdsForToday(userId) {
  const { data, error } = await supabase
    .from('medicine_taken_logs')
    .select('medicine_id')
    .eq('user_id', userId)
    .eq('taken_date', todayStr())

  if (error) {
    console.error('[medicineService] fetchTakenIdsForToday error:', error)
    return []
  }
  return (data || []).map(r => r.medicine_id)
}

// ── İlaç adına göre işaretle (sesli komut için) ───────────────────────────────
export async function markMedicineTakenByName(userId, medicineName, allMedicines) {
  const med = allMedicines.find(
    m => m.name.toLowerCase() === medicineName.toLowerCase()
      || medicineName.toLowerCase().includes(m.name.toLowerCase())
  )
  if (!med) return { success: false, error: `"${medicineName}" ilaçlarınızda bulunamadı.` }
  const result = await markMedicineTaken(userId, med.id)
  return { ...result, medicine: med }
}