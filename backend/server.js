/**
 * E-Baston — Node.js Backend
 * Groq API + Gelişmiş Sesli Komutlar
 */

require('dotenv').config()
const express = require('express')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json())

const GROQ_API_KEY = process.env.GROQ_API_KEY
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.1-8b-instant'

// ── Yardımcı: Groq çağrısı ───────────────────────────────────────────────────
async function callGroq({ systemPrompt, messages, maxTokens = 800 }) {
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: maxTokens,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Groq hatası: ${response.status} — ${err}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

// ── Mesaj temizleme ──────────────────────────────────────────────────────────
function sanitizeMessages(messages) {
  const valid = messages.filter(m =>
    (m.role === 'user' || m.role === 'assistant') &&
    typeof m.content === 'string' &&
    m.content.trim().length > 0
  )
  let start = 0
  while (start < valid.length && valid[start].role !== 'user') start++
  const trimmed = valid.slice(start)
  if (trimmed.length === 0) return []
  const result = [trimmed[0]]
  for (let i = 1; i < trimmed.length; i++) {
    const prev = result[result.length - 1]
    if (trimmed[i].role === prev.role) {
      prev.content += '\n' + trimmed[i].content
    } else {
      result.push({ role: trimmed[i].role, content: trimmed[i].content })
    }
  }
  return result
}

// ── Endpoint 1: Sağlık sohbeti ───────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, userContext } = req.body
    if (!messages || messages.length === 0) return res.status(400).json({ error: 'Mesaj gerekli' })

    const contextParts = []
    if (userContext?.medicines?.length) {
      contextParts.push(`Kullanıcının ilaçları: ${userContext.medicines.map(m => `${m.name} (${m.dose || 'doz belirtilmemiş'})`).join(', ')}`)
    }
    if (userContext?.healthRecords?.length) {
      const latest = userContext.healthRecords[0]
      const parts = []
      if (latest.blood_pressure) parts.push(`tansiyon: ${latest.blood_pressure}`)
      if (latest.blood_sugar) parts.push(`kan şekeri: ${latest.blood_sugar} mg/dL`)
      if (latest.pulse) parts.push(`nabız: ${latest.pulse} bpm`)
      if (latest.weight) parts.push(`kilo: ${latest.weight} kg`)
      if (parts.length) contextParts.push(`Son sağlık ölçümleri: ${parts.join(', ')}`)
    }

    const systemPrompt = `Sen E-Baston uygulamasının yapay zeka sağlık asistanısın.
Kullanıcılara sağlıklı yaşam, ilaç kullanımı, sağlık takibi konularında Türkçe yardım edersin.
Samimi, destekleyici ve anlaşılır bir dil kullanırsın.
ÖNEMLİ: Teşhis koyma. Ciddi semptomlar için mutlaka doktora yönlendir.
Kısa ve net yanıtlar ver (max 3-4 paragraf).
${contextParts.length ? '\nKullanıcı bağlamı:\n' + contextParts.join('\n') : ''}`

    const cleaned = sanitizeMessages(messages)
    if (cleaned.length === 0) return res.status(400).json({ error: 'Geçerli mesaj bulunamadı' })

    const result = await callGroq({ systemPrompt, messages: cleaned, maxTokens: 800 })
    res.json({ text: result })
  } catch (err) {
    console.error('[/api/chat] Hata:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Endpoint 2: İlaç adı düzeltme ───────────────────────────────────────────
app.post('/api/medicine-name', async (req, res) => {
  try {
    const { spokenText } = req.body
    if (!spokenText) return res.status(400).json({ error: 'spokenText gerekli' })

    const result = await callGroq({
      systemPrompt: `Sen bir Türk eczacısın. Kullanıcının söylediği ilaç adını düzelt.
Türkiye'de yaygın ilaçlar: Metformin, Coraspin, Aspirin, Majezik, Neopril, Diovan, Coversyl, Beloc, Concor, Lipitor, Crestor, Glucophage, Norvasc, Lasix vb.
SADECE JSON döndür, başka hiçbir şey yazma. Markdown kullanma.`,
      messages: [{
        role: 'user',
        content: `"${spokenText}" — Bu ilaç adını düzelt:
{"isValid": true, "correctedName": "İlaç İsmi", "confidence": "high", "suggestion": "Şunu mu demek istediniz?"}`
      }],
      maxTokens: 150,
    })

    const jsonMatch = result.match(/\{[\s\S]*\}/)
    if (jsonMatch) res.json(JSON.parse(jsonMatch[0]))
    else res.json({ isValid: true, correctedName: spokenText, confidence: 'medium' })
  } catch (err) {
    console.error('[/api/medicine-name] Hata:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Endpoint 3: Gelişmiş sesli komut işleme ──────────────────────────────────
app.post('/api/voice-command', async (req, res) => {
  try {
    const { command, medicines, familyMembers } = req.body
    if (!command) return res.status(400).json({ error: 'command gerekli' })

    const medList = medicines?.map(m => m.name).join(', ') || 'yok'
    const familyList = familyMembers?.map(m => `${m.name} (${m.phone || 'telefon yok'})`).join(', ') || 'yok'

    const result = await callGroq({
      systemPrompt: `Sen bir Türkçe sesli komut işleyicisisin. Kullanıcının ne yapmak istediğini analiz et.

Mevcut ilaçlar: ${medList}
Aile üyeleri: ${familyList}

Desteklenen aksiyonlar:
- navigate: Ekrana git. target = ekran adı (Ana Sayfa, İlaçlarım, Sağlığım, Ailem, Planlarım, İstatistik, AI Asistan, Profil)
- markMedicine: İlaç alındı işaretle. medicineName = ilaç adı
- callFamily: Aile üyesini ara. memberName = kişi adı, phone = telefon numarası
- addMedicine: Yeni ilaç ekle. medicineName, dose, days (dizi), times (dizi) 
- addPlan: Plan/randevu ekle. title, date (YYYY-MM-DD), time (HH:MM), note
- unknown: Anlaşılamadı

Bugünün tarihi: ${new Date().toISOString().split('T')[0]}
Yarın: ${new Date(Date.now() + 86400000).toISOString().split('T')[0]}

SADECE JSON döndür. Markdown kullanma. Örnek:
{"action": "markMedicine", "medicineName": "Aspirin", "confidence": "high", "confirmMessage": "Aspirin alındı olarak işaretleyeyim mi?"}
{"action": "callFamily", "memberName": "Ayşe", "phone": "05321234567", "confidence": "high", "confirmMessage": "Ayşe'yi arıyorum"}
{"action": "addPlan", "title": "Doktor Randevusu", "date": "2026-02-28", "time": "15:00", "note": "", "confidence": "high", "confirmMessage": "Yarın saat 15:00'e Doktor Randevusu ekleyeyim mi?"}
{"action": "addMedicine", "medicineName": "Aspirin", "dose": "500mg", "days": ["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"], "times": ["08:00","20:00"], "confidence": "high", "confirmMessage": "Aspirin 500mg, her gün sabah-akşam ekleyeyim mi?"}`,
      messages: [{ role: 'user', content: `Kullanıcı dedi: "${command}"` }],
      maxTokens: 300,
    })

    const jsonMatch = result.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      res.json({ ...JSON.parse(jsonMatch[0]), source: 'groq' })
    } else {
      res.json({ action: 'unknown', confidence: 'low', source: 'fallback' })
    }
  } catch (err) {
    console.error('[/api/voice-command] Hata:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Sağlık kontrolü ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', model: GROQ_MODEL })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`✅ E-Baston Backend çalışıyor: http://localhost:${PORT}`)
  console.log(`🔑 Groq key: ${GROQ_API_KEY ? '✓ Yüklendi' : '✗ EKSİK!'}`)
})