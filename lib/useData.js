/**
 * CanBakım — Global Data Hooks
 * v2: Supabase Realtime + hata yönetimi iyileştirildi
 */

import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { markMedicineTaken, unmarkMedicineTaken, fetchTakenIdsForToday } from './medicineService'
import { scheduleMedicineNotifications, cancelMedicineNotifications, schedulePlanNotification, cancelPlanNotification } from './notifications'

const todayStr = () => new Date().toISOString().split('T')[0]

// ── Realtime yardımcı hook ────────────────────────────────────────────────────
function useRealtimeTable(table, userId, onChange) {
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`rt_${table}_${userId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
        onChange
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])
}

// ── Kullanıcı ─────────────────────────────────────────────────────────────────
export function useUser() {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUser()
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null)
      if (session?.user) loadProfile(session.user.id)
      else setProfile(null)
    })
    return () => listener?.subscription?.unsubscribe()
  }, [])

  async function loadUser() {
    const { data: { user: u } } = await supabase.auth.getUser()
    setUser(u)
    if (u) await loadProfile(u.id)
    setLoading(false)
  }

  async function loadProfile(uid) {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    if (data) setProfile(data)
  }

  async function saveProfile(updates) {
    if (!user) return { success: false, error: 'Kullanıcı bulunamadı' }
    const { error } = await supabase.from('profiles').upsert({
      id: user.id, ...updates, updated_at: new Date().toISOString()
    })
    if (!error) setProfile(prev => ({ ...prev, ...updates }))
    return { success: !error, error: error?.message }
  }

  return { user, profile, loading, saveProfile, reload: loadUser }
}

// ── İlaçlar ───────────────────────────────────────────────────────────────────
export function useMedicines() {
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading]     = useState(true)
  const [userId, setUserId]       = useState(null)

  useEffect(() => { load() }, [])

  useRealtimeTable('medicines', userId, ({ eventType, new: n, old: o }) => {
    if (eventType === 'INSERT') setMedicines(prev => prev.some(m => m.id === n.id) ? prev : [n, ...prev])
    else if (eventType === 'UPDATE') setMedicines(prev => prev.map(m => m.id === n.id ? n : m))
    else if (eventType === 'DELETE') setMedicines(prev => prev.filter(m => m.id !== o.id))
  })

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)
    const { data, error } = await supabase
      .from('medicines').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (!error) setMedicines(data || [])
    setLoading(false)
  }

  async function addMedicine(medData) {
    if (!userId) return { success: false, error: 'Kullanıcı bulunamadı' }
    const COLORS = ['#E07B4F','#4A9B8E','#6B5B8E','#F0A500','#E05050']
    const ICONS  = ['💊','🔵','🟡','🟢','❤️']
    const idx = medicines.length % COLORS.length
    const { data, error } = await supabase.from('medicines')
      .insert({ user_id: userId, color: COLORS[idx], icon: ICONS[idx], ...medData })
      .select().single()
    if (error) return { success: false, error: error.message }
    await scheduleMedicineNotifications(data)
    return { success: true, medicine: data }
  }

  async function deleteMedicine(id) {
    const med = medicines.find(m => m.id === id)
    if (med) await cancelMedicineNotifications(id, med.days || [], med.times || [])
    const { error } = await supabase.from('medicines').delete().eq('id', id)
    if (!error) setMedicines(prev => prev.filter(m => m.id !== id))
    return { success: !error, error: error?.message }
  }

  return { medicines, loading, userId, refresh: load, addMedicine, deleteMedicine }
}

// ── Alınan ilaçlar ────────────────────────────────────────────────────────────
export function useTakenMedicines(userId) {
  const [takenIds, setTakenIds] = useState([])

  useEffect(() => { if (userId) load() }, [userId])

  useRealtimeTable('medicine_taken_logs', userId, ({ eventType, new: n, old: o }) => {
    const today = todayStr()
    if (eventType === 'INSERT' && n.taken_date === today)
      setTakenIds(prev => prev.includes(n.medicine_id) ? prev : [...prev, n.medicine_id])
    else if (eventType === 'DELETE')
      setTakenIds(prev => prev.filter(id => id !== o.medicine_id))
  })

  async function load() {
    const ids = await fetchTakenIdsForToday(userId)
    setTakenIds(ids)
  }

  async function markTaken(medicineId, medicineName, speakFn) {
    const isTaken = takenIds.includes(medicineId)
    // Optimistic UI
    if (isTaken) setTakenIds(prev => prev.filter(id => id !== medicineId))
    else { setTakenIds(prev => [...prev, medicineId]); speakFn?.(medicineName + ' alındı olarak işaretlendi') }

    const result = isTaken
      ? await unmarkMedicineTaken(userId, medicineId)
      : await markMedicineTaken(userId, medicineId)

    // Hata → geri al
    if (!result.success) {
      if (isTaken) setTakenIds(prev => [...prev, medicineId])
      else setTakenIds(prev => prev.filter(id => id !== medicineId))
    }
    return result
  }

  return { takenIds, markTaken, refresh: load }
}

// ── Planlar ───────────────────────────────────────────────────────────────────
export function usePlans(date) {
  const [plans, setPlans]       = useState([])
  const [allDates, setAllDates] = useState({})
  const [loading, setLoading]   = useState(false)
  const [userId, setUserId]     = useState(null)

  useEffect(() => { initUser(); loadAllDates() }, [])
  useEffect(() => { if (date && userId) loadPlans(date) }, [date, userId])

  useRealtimeTable('plans', userId, ({ eventType, new: n, old: o }) => {
    if (eventType === 'INSERT' && n.plan_date === date)
      setPlans(prev => prev.some(p => p.id === n.id) ? prev : [...prev, n].sort((a, b) => (a.plan_time||'').localeCompare(b.plan_time||'')))
    else if (eventType === 'UPDATE')
      setPlans(prev => prev.map(p => p.id === n.id ? n : p))
    else if (eventType === 'DELETE')
      setPlans(prev => prev.filter(p => p.id !== o.id))
    loadAllDates()
  })

  async function initUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setUserId(user.id)
  }

  async function loadPlans(d) {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('plans').select('*').eq('user_id', userId)
      .eq('plan_date', d).order('plan_time', { ascending: true })
    if (!error) setPlans(data || [])
    setLoading(false)
  }

  async function loadAllDates() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('plans').select('plan_date, is_done').eq('user_id', user.id)
    if (!data) return
    const marks = {}
    data.forEach(plan => {
      const d = plan.plan_date
      if (!marks[d]) marks[d] = { dots: [], marked: true }
      const color = plan.is_done ? '#06D6A0' : '#4361EE'
      if (!marks[d].dots.find(dot => dot.color === color)) marks[d].dots.push({ color })
    })
    setAllDates(marks)
  }

  async function addPlan(planData) {
    if (!userId) return { success: false, error: 'Kullanıcı bulunamadı' }
    const { data, error } = await supabase.from('plans')
      .insert({ user_id: userId, is_done: false, ...planData })
      .select().single()
    if (error) return { success: false, error: error.message }
    await schedulePlanNotification(data)
    loadAllDates()
    return { success: true, plan: data }
  }

  async function deletePlan(id) {
    await cancelPlanNotification(id)
    const { error } = await supabase.from('plans').delete().eq('id', id)
    if (!error) setPlans(prev => prev.filter(p => p.id !== id))
    loadAllDates()
    return { success: !error, error: error?.message }
  }

  async function toggleDone(plan) {
    setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, is_done: !plan.is_done } : p))
    const { error } = await supabase.from('plans').update({ is_done: !plan.is_done }).eq('id', plan.id)
    if (error) setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, is_done: plan.is_done } : p))
    loadAllDates()
    return { success: !error, error: error?.message }
  }

  return { plans, allDates, loading, userId, addPlan, deletePlan, toggleDone, refresh: () => { loadPlans(date); loadAllDates() } }
}

// ── Sağlık kayıtları ──────────────────────────────────────────────────────────
export function useHealthRecords() {
  const [records, setRecords] = useState([])
  const [latest, setLatest]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId]   = useState(null)

  useEffect(() => { load() }, [])

  useRealtimeTable('health_records', userId, ({ eventType, new: n, old: o }) => {
    if (eventType === 'INSERT') {
      setRecords(prev => { const u = [n, ...prev].slice(0, 20); setLatest(u[0]); return u })
    } else if (eventType === 'DELETE') {
      setRecords(prev => { const u = prev.filter(r => r.id !== o.id); setLatest(u[0] || null); return u })
    }
  })

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)
    const { data, error } = await supabase
      .from('health_records').select('*').eq('user_id', user.id)
      .order('recorded_at', { ascending: false }).limit(20)
    if (!error && data) { setRecords(data); setLatest(data[0] || null) }
    setLoading(false)
  }

  async function addRecord(recordData) {
    if (!userId) return { success: false, error: 'Kullanıcı bulunamadı' }
    const { data, error } = await supabase.from('health_records')
      .insert({ user_id: userId, ...recordData }).select().single()
    if (error) return { success: false, error: error.message }
    setRecords(prev => [data, ...prev])
    setLatest(data)
    return { success: true, record: data }
  }

  async function deleteRecord(id) {
    const { error } = await supabase.from('health_records').delete().eq('id', id)
    if (!error) {
      const updated = records.filter(r => r.id !== id)
      setRecords(updated); setLatest(updated[0] || null)
    }
    return { success: !error, error: error?.message }
  }

  return { records, latest, loading, userId, addRecord, deleteRecord, refresh: load }
}

// ── Aile üyeleri ──────────────────────────────────────────────────────────────
export function useFamilyMembers() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId]   = useState(null)

  useEffect(() => { load() }, [])

  useRealtimeTable('family_members', userId, ({ eventType, new: n, old: o }) => {
    if (eventType === 'INSERT') setMembers(prev => prev.some(m => m.id === n.id) ? prev : [...prev, n])
    else if (eventType === 'UPDATE') setMembers(prev => prev.map(m => m.id === n.id ? n : m))
    else if (eventType === 'DELETE') setMembers(prev => prev.filter(m => m.id !== o.id))
  })

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)
    const { data, error } = await supabase
      .from('family_members').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: true })
    if (!error) setMembers(data || [])
    setLoading(false)
  }

  async function addMember(memberData) {
    if (!userId) return { success: false, error: 'Kullanıcı bulunamadı' }
    const COLORS = ['#E07B4F','#4361EE','#E05050','#06D6A0','#7209B7','#F0A500','#4CC9F0','#6B5B8E']
    const idx = members.length % COLORS.length
    const { data, error } = await supabase.from('family_members')
      .insert({ user_id: userId, color: COLORS[idx], ...memberData }).select().single()
    if (error) return { success: false, error: error.message }
    setMembers(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data])
    return { success: true, member: data }
  }

  async function deleteMember(id) {
    const { error } = await supabase.from('family_members').delete().eq('id', id)
    if (!error) setMembers(prev => prev.filter(m => m.id !== id))
    return { success: !error, error: error?.message }
  }

  return { members, loading, userId, addMember, deleteMember, refresh: load }
}

// ── İstatistikler ─────────────────────────────────────────────────────────────
export function useStats() {
  const [stats, setStats] = useState({ medCount:0, planCount:0, familyCount:0, takenThisWeek:0, healthRecordCount:0 })
  const [loading, setLoading] = useState(true)
  const [userId, setUserId]   = useState(null)

  useEffect(() => { load() }, [])

  // İlgili tablolar değişince istatistikleri yenile
  useRealtimeTable('medicines',           userId, () => load())
  useRealtimeTable('plans',               userId, () => load())
  useRealtimeTable('family_members',      userId, () => load())
  useRealtimeTable('medicine_taken_logs', userId, () => load())

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)
    const weekAgo = new Date(Date.now() - 7*86400000).toISOString().split('T')[0]
    const [meds, plans, family, taken, health] = await Promise.all([
      supabase.from('medicines').select('id', { count: 'exact' }).eq('user_id', user.id),
      supabase.from('plans').select('id', { count: 'exact' }).eq('user_id', user.id),
      supabase.from('family_members').select('id', { count: 'exact' }).eq('user_id', user.id),
      supabase.from('medicine_taken_logs').select('id', { count: 'exact' }).eq('user_id', user.id).gte('taken_date', weekAgo),
      supabase.from('health_records').select('id', { count: 'exact' }).eq('user_id', user.id),
    ])
    setStats({ medCount: meds.count||0, planCount: plans.count||0, familyCount: family.count||0, takenThisWeek: taken.count||0, healthRecordCount: health.count||0 })
    setLoading(false)
  }

  return { stats, loading, refresh: load }
}