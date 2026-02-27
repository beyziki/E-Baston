/**
 * E-Baston — Claude & Backend API
 *
 * Tüm URL ve key'ler .env → app.config.js → Constants üzerinden okunur.
 * Hiçbir değer doğrudan kod içine yazılmaz.
 *
 * .env dosyası:
 *   SUPABASE_URL=...
 *   SUPABASE_ANON_KEY=...
 *   BACKEND_URL=http://10.33.19.150:3000   ← sadece burada, GitHub'a gitmez
 *
 * app.config.js extra:
 *   backendUrl: process.env.BACKEND_URL || 'http://localhost:3000'
 */

import Constants from 'expo-constants'

// ── API Key ───────────────────────────────────────────────────────────────────
function getApiKey() {
  const key = Constants.expoConfig?.extra?.claudeApiKey
  if (key) return key
  if (__DEV__) return process.env.CLAUDE_API_KEY || ''
  console.error('[E-Baston] Claude API key bulunamadı!')
  return ''
}

// ── Backend URL ───────────────────────────────────────────────────────────────
function getBackendUrl() {
  const url = Constants.expoConfig?.extra?.backendUrl
  if (url) return url

  if (__DEV__) {
    console.warn('[E-Baston] BACKEND_URL tanımlı değil, localhost kullanılıyor.')
    return 'http://localhost:3000'
  }

  // Production'da URL yoksa hata fırlat — sessizce yanlış IP'ye düşme
  throw new Error('[E-Baston] BACKEND_URL tanımlı değil! .env ve app.config.js dosyalarını kontrol edin.')
}

const CLAUDE_MODEL    = 'claude-3-5-sonnet-20241022'
const CLAUDE_BASE_URL = 'https://api.anthropic.com/v1/messages'

// ── Dahili Claude çağrısı ─────────────────────────────────────────────────────
async function callClaude({ systemPrompt, userMessage, maxTokens = 300 }) {
  const key = getApiKey()
  if (!key) throw new Error('Claude API key eksik')

  const response = await fetch(CLAUDE_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude API hatası: ${response.status} — ${err}`)
  }

  const data = await response.json()
  return data.content?.[0]?.text || ''
}

// ── Backend çağrısı (Groq/Node.js) ───────────────────────────────────────────
export async function callBackend(endpoint, body) {
  const baseUrl = getBackendUrl()
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Backend hatası: ${response.status} — ${err}`)
  }
  return response.json()
}

// ── İlaç ismi düzeltme ────────────────────────────────────────────────────────
export async function improveMedicineName(spokenText) {
  try {
    const text = await callClaude({
      systemPrompt: `Sen bir Türk eczacısın. Kullanıcının söylediği ilaç adını düzelt.
Türkiye'de yaygın ilaçlar: Metformin, Coraspin, Aspirin, Majezik, Neopril, Diovan, Coversyl, Beloc, Concor, Lipitor, Crestor, Glucophage, Norvasc, Lasix vb.
SADECE JSON döndür, başka hiçbir şey yazma.`,
      userMessage: `"${spokenText}" — Bu ilaç adını düzelt:
{
  "isValid": true,
  "correctedName": "Düzeltilmiş İlaç İsmi",
  "confidence": "high",
  "suggestion": "Şunu mu demek istediniz?"
}`,
      maxTokens: 150,
    })

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) return JSON.parse(jsonMatch[0])
    return { isValid: true, correctedName: spokenText, confidence: 'medium' }
  } catch (e) {
    console.error('improveMedicineName error:', e)
    return { isValid: true, correctedName: spokenText, confidence: 'low' }
  }
}

// ── Sesli komut işleme ────────────────────────────────────────────────────────
function matchCommandLocally(text) {
  const lower = text.toLowerCase().trim()

  const navPatterns = [
    { keywords: ['ana sayfa', 'anasayfa', 'ana ekran', 'eve git', 'başa dön'], target: 'Ana Sayfa' },
    { keywords: ['ilaçlarım', 'ilaçlarıma', 'ilaç sayfası'], target: 'İlaçlarım' },
    { keywords: ['sağlığım', 'sağlığıma', 'sağlık sayfası'], target: 'Sağlığım' },
    { keywords: ['ailem', 'aileme', 'aile sayfası'], target: 'Ailem' },
    { keywords: ['planlarım', 'planlarıma', 'plan sayfası', 'takvim'], target: 'Planlarım' },
    { keywords: ['istatistik', 'grafik', 'rapor', 'istatistikler'], target: 'İstatistik' },
    { keywords: ['ai asistan', 'yapay zeka', 'asistan', 'chat', 'sohbet'], target: 'AI Asistan' },
    { keywords: ['profilim', 'profilime', 'profil sayfası', 'ayarlar'], target: 'Profil' },
  ]
  const navVerbs = ['git', 'aç', 'gidelim', 'gir', 'geç', 'göster', 'bak', 'götür']
  const hasNavVerb = navVerbs.some(v => lower.includes(v))

  for (const { keywords, target } of navPatterns) {
    if (keywords.some(k => lower.includes(k))) {
      return { action: 'navigate', target, confidence: hasNavVerb ? 'high' : 'medium', source: 'local' }
    }
  }

  if (['ilaç ekle', 'yeni ilaç ekle', 'ilaç kaydet'].some(k => lower.includes(k)))
    return { action: 'addMedicine', target: 'İlaçlarım', confidence: 'high', source: 'local' }

  if (['plan ekle', 'randevu ekle', 'etkinlik ekle', 'takvime ekle'].some(k => lower.includes(k)))
    return { action: 'addPlan', target: 'Planlarım', confidence: 'high', source: 'local' }

  return null
}

export async function processVoiceCommand(command) {
  const local = matchCommandLocally(command)
  if (local && local.confidence === 'high') return local

  try {
    const text = await callClaude({
      systemPrompt: `Sen bir mobil sağlık uygulaması sesli komut işleyicisisin.
Uygulama ekranları: "Ana Sayfa", "İlaçlarım", "Sağlığım", "Ailem", "Planlarım", "İstatistik", "AI Asistan", "Profil"
Aksiyonlar: navigate, addMedicine, addPlan, unknown
Emin değilsen action="unknown" ver.
SADECE JSON döndür.`,
      userMessage: `Kullanıcı dedi: "${command}"
{
  "action": "navigate",
  "target": "Tam ekran adı",
  "confidence": "high/medium/low"
}`,
      maxTokens: 100,
    })

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) return { ...JSON.parse(jsonMatch[0]), source: 'claude' }
  } catch (e) {
    console.error('processVoiceCommand error:', e)
  }

  return local || { action: 'unknown', confidence: 'low', source: 'fallback' }
}

// ── AI Sağlık Sohbeti ─────────────────────────────────────────────────────────
export async function sendHealthChatMessage(messages, userContext = {}) {
  const contextParts = []

  if (userContext.medicines?.length) {
    contextParts.push(`Kullanıcının ilaçları: ${userContext.medicines.map(m => `${m.name} (${m.dose || 'doz belirtilmemiş'})`).join(', ')}`)
  }
  if (userContext.healthRecords?.length) {
    const latest = userContext.healthRecords[0]
    const parts = []
    if (latest.blood_pressure) parts.push(`tansiyon: ${latest.blood_pressure}`)
    if (latest.blood_sugar)    parts.push(`kan şekeri: ${latest.blood_sugar} mg/dL`)
    if (latest.pulse)          parts.push(`nabız: ${latest.pulse} bpm`)
    if (latest.weight)         parts.push(`kilo: ${latest.weight} kg`)
    if (parts.length) contextParts.push(`Son sağlık ölçümleri: ${parts.join(', ')}`)
  }

  const systemPrompt = `Sen E-Baston uygulamasının yapay zeka sağlık asistanısın.
Kullanıcılara sağlıklı yaşam, ilaç kullanımı, sağlık takibi konularında Türkçe yardım edersin.
Samimi, destekleyici ve anlaşılır bir dil kullanırsın.
ÖNEMLİ: Teşhis koyma. Ciddi semptomlar için mutlaka doktora yönlendir.
Kısa ve net yanıtlar ver (max 3-4 paragraf).

${contextParts.length ? 'Kullanıcı bağlamı:\n' + contextParts.join('\n') : ''}`

  const key = getApiKey()
  if (!key) throw new Error('Claude API key eksik')

  const response = await fetch(CLAUDE_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 600,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  })

  if (!response.ok) throw new Error(`API hatası: ${response.status}`)
  const data = await response.json()
  return data.content?.[0]?.text || 'Yanıt alınamadı.'
}