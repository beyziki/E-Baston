import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

// Türkçe gün adı → weekday sayısı (1=Pazar, 2=Pzt, ..., 7=Cmt)
const DAY_TO_WEEKDAY = {
  'Paz': 1,
  'Pzt': 2,
  'Sal': 3,
  'Çar': 4,
  'Per': 5,
  'Cum': 6,
  'Cmt': 7,
}

export async function setupNotifications() {
  console.log('[E-Baston] Bildirim sistemi hazırlanıyor...')

  if (__DEV__) {
    console.log('[E-Baston] Dev modda bildirimler devre dışı (Expo Go kısıtlaması)')
    return false
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('[E-Baston] Bildirim izni verilmedi')
    return false
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('medicine-reminders', {
      name: 'İlaç Hatırlatmaları',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    })
    await Notifications.setNotificationChannelAsync('plan-reminders', {
      name: 'Plan Hatırlatmaları',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    })
  }

  console.log('[E-Baston] Bildirim sistemi hazır')
  return true
}

// ── İlaç Bildirimleri ─────────────────────────────────────────────────────────

export async function scheduleMedicineNotifications(medicine) {
  if (__DEV__) {
    console.log('[E-Baston] Dev mod - bildirim planlanamaz:', medicine.name)
    return
  }

  try {
    const { days, times, name, id } = medicine

    for (const day of (days || [])) {
      const weekday = DAY_TO_WEEKDAY[day]
      if (!weekday) {
        console.warn(`[E-Baston] Bilinmeyen gün: ${day}`)
        continue
      }

      for (const time of (times || [])) {
        const [hour, minute] = time.split(':').map(Number)

        // Her gün için ayrı unique identifier
        const identifier = `med_${id}_${day}_${time.replace(':', '')}`

        await Notifications.scheduleNotificationAsync({
          identifier,
          content: {
            title: '💊 İlaç Zamanı!',
            body: `${name} almanız gerekiyor`,
            data: { medicineId: id, type: 'medicine' },
            sound: 'default',
            // Android için channelId content içinde
            ...(Platform.OS === 'android' && { channelId: 'medicine-reminders' }),
          },
          trigger: {
            weekday,   // 1=Pazar ... 7=Cumartesi
            hour,
            minute,
            repeats: true,
          },
        })
      }
    }
    console.log(`[E-Baston] ${name} için ${(days||[]).length} gün × ${(times||[]).length} saat = ${(days||[]).length * (times||[]).length} bildirim planlandı`)
  } catch (e) {
    console.warn('[E-Baston] Bildirim planlama hatası:', e.message)
  }
}

export async function cancelMedicineNotifications(medicineId, days = [], times = []) {
  if (__DEV__) return
  try {
    // Önce identifier ile direkt iptal et
    const identifiers = []
    for (const day of days) {
      for (const time of times) {
        identifiers.push(`med_${medicineId}_${day}_${time.replace(':', '')}`)
      }
    }
    await Promise.all(identifiers.map(id =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
    ))

    // Kaçan varsa data üzerinden de temizle
    const scheduled = await Notifications.getAllScheduledNotificationsAsync()
    const remaining = scheduled.filter(
      n => n.content?.data?.medicineId === medicineId && n.content?.data?.type === 'medicine'
    )
    await Promise.all(remaining.map(n =>
      Notifications.cancelScheduledNotificationAsync(n.identifier)
    ))

    console.log(`[E-Baston] İlaç (${medicineId}) bildirimleri iptal edildi`)
  } catch (e) {
    console.warn('[E-Baston] Bildirim iptal hatası:', e.message)
  }
}

// ── Plan Bildirimleri ─────────────────────────────────────────────────────────

export async function schedulePlanNotification(plan) {
  if (__DEV__) {
    console.log('[E-Baston] Dev mod - plan bildirimi planlanamaz:', plan.title)
    return
  }

  try {
    if (!plan.plan_date || !plan.plan_time) return

    const [hour, minute] = plan.plan_time.split(':').map(Number)
    const [year, month, day] = plan.plan_date.split('-').map(Number)

    // 15 dakika önce bildir
    const notifDate = new Date(year, month - 1, day, hour, minute - 15)
    if (notifDate <= new Date()) {
      console.log('[E-Baston] Geçmiş tarih, plan bildirimi planlanmadı')
      return
    }

    await Notifications.scheduleNotificationAsync({
      identifier: `plan_${plan.id}`,
      content: {
        title: '📅 Yaklaşan Plan',
        body: `${plan.title} — 15 dakika sonra`,
        data: { planId: plan.id, type: 'plan' },
        sound: 'default',
        ...(Platform.OS === 'android' && { channelId: 'plan-reminders' }),
      },
      trigger: {
        type: 'date',
        date: notifDate,
      },
    })
    console.log(`[E-Baston] Plan bildirimi planlandı: ${plan.title} → ${notifDate.toLocaleString('tr-TR')}`)
  } catch (e) {
    console.warn('[E-Baston] Plan bildirimi hatası:', e.message)
  }
}

export async function cancelPlanNotification(planId) {
  if (__DEV__) return
  try {
    await Notifications.cancelScheduledNotificationAsync(`plan_${planId}`)
    console.log(`[E-Baston] Plan (${planId}) bildirimi iptal edildi`)
  } catch (e) {
    console.warn('[E-Baston] Plan bildirimi iptal hatası:', e.message)
  }
}

export async function cancelAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync()
    console.log('[E-Baston] Tüm bildirimler iptal edildi')
  } catch (e) {
    console.warn('[E-Baston] Tüm iptal hatası:', e.message)
  }
}