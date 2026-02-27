<div align="center">

# 🦯 E-Baston

### Yapay Zeka Destekli Mobil Sağlık Takip Uygulaması

*Yaşlı bireyler ve kronik hastalar için sesli komut, ilaç takibi ve AI sağlık asistanı*

<br/>

[![React Native](https://img.shields.io/badge/React%20Native-0.76-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev)
[![Expo](https://img.shields.io/badge/Expo-SDK%2052-000020?style=for-the-badge&logo=expo)](https://expo.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Groq](https://img.shields.io/badge/Groq-Llama%203.1-F55036?style=for-the-badge)](https://groq.com)

</div>

---

## 📱 Ekranlar

| Ana Sayfa | İlaçlarım | AI Asistan | Sağlığım |
|-----------|-----------|------------|----------|
| Günlük özet | İlaç programı | Türkçe sohbet | Ölçüm geçmişi |

---

## ✨ Özellikler

**💊 İlaç Yönetimi**
Haftalık ilaç programı oluşturun, alındı işaretleyin, kaçırılan dozları takip edin. Belirlenen gün ve saatlerde otomatik push bildirimi alın.

**🎙️ Sesli Komutlar**
Ekrana dokunmadan "Aspirin aldım", "Anneyi ara" veya "Yarın saat 15'e doktor randevusu ekle" gibi doğal Türkçe komutlar verin. Groq/Llama 3.1 ile milisaniyeler içinde işlenir.

**🤖 AI Sağlık Asistanı**
İlaç etkileşimleri, sağlıklı yaşam önerileri ve sağlık sorularınız için 7/24 Türkçe AI desteği. Kendi ölçüm geçmişinizi bağlam olarak kullanır.

**📊 Sağlık Takibi**
Tansiyon, kan şekeri, nabız ve kilo ölçümlerinizi kaydedin. Grafik ve istatistiklerle zamanla değişiminizi görün.

**👨‍👩‍👧 Aile Yönetimi**
Aile üyelerinizin ilaç programlarını takip edin, tek dokunuşla arayın.

**🌙 Dark Mode & Erişilebilirlik**
Tam karanlık/aydınlık mod. Sesli okuma (TTS) ile tüm ekran içerikleri dinlenebilir.

---

## 🏗️ Proje Yapısı

```
E-Baston/
├── App.js                         # Uygulama giriş noktası
├── app.config.js                  # Expo + env yapılandırması
├── .env                           # 🔒 Gizli anahtarlar (GitHub'a gitmez)
├── .env.example                   # Şablon
│
├── screens/
│   ├── HomeScreen.js              # Ana sayfa — günün özeti
│   ├── MedicinesScreen.js         # İlaç listesi ve yönetimi
│   ├── HealthScreen.js            # Sağlık ölçümleri
│   ├── FamilyScreen.js            # Aile üyeleri
│   ├── PlanningScreen.js          # Takvim ve randevular
│   ├── StatsScreen.js             # İstatistik ve grafikler
│   ├── AIChatScreen.js            # AI sağlık sohbeti
│   ├── ProfileScreen.js           # Kullanıcı profili
│   ├── LoginScreen.js             # Giriş / Kayıt
│   ├── GlobalVoiceAssistant.js    # Sesli komut işleyici
│   └── VoiceMedicineAdd.js        # Sesli ilaç ekleme
│
├── lib/
│   ├── useData.js                 # Global data hook'ları + Realtime
│   ├── supabase.js                # Supabase istemcisi
│   ├── medicineService.js         # İlaç servis katmanı
│   ├── claudeAPI.js               # Claude & backend API
│   ├── notifications.js           # Push bildirim yönetimi
│   ├── ThemeContext.js            # Dark/light mod
│   ├── SpeechContext.js           # TTS sesli okuma
│   ├── VoiceContext.js            # Sesli modül yönetimi
│   ├── ToastContext.js            # Toast bildirimleri
│   └── theme.js                   # Renk paleti, tipografi
│
├── components/
│   ├── MedicineCard.js            # React.memo ilaç kartı
│   └── ChatMessage.js             # React.memo sohbet balonu
│
└── backend/
    ├── server.js                  # Express + Groq API
    ├── package.json
    ├── .env                       # 🔒 GROQ_API_KEY (GitHub'a gitmez)
    └── .env.example
```

---

## 🛠️ Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| Framework | React Native 0.76 + Expo SDK 52 |
| Veritabanı | Supabase (PostgreSQL + Realtime) |
| Kimlik Doğrulama | Supabase Auth |
| AI (Sohbet) | Groq API — Llama 3.1 8B Instant |
| AI (Komut/İlaç) | Claude 3.5 Sonnet |
| Backend | Node.js + Express |
| Bildirimler | expo-notifications |
| Sesli Okuma | expo-speech |
| Ses Tanıma | expo-speech-recognition |
| Navigasyon | React Navigation v6 |

---

## ⚡ Kurulum

### Gereksinimler

- Node.js 18+
- Expo CLI → `npm install -g @expo/cli`
- [Supabase](https://supabase.com) hesabı (ücretsiz)
- [Groq](https://console.groq.com) API anahtarı (ücretsiz)

### 1. Klonla

```bash
git clone https://github.com/beyziki/E-Baston.git
cd E-Baston
npm install
```

### 2. Ortam Değişkenleri

```bash
cp .env.example .env
```

`.env` dosyasını doldurun:

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=sb_publishable_xxxx
BACKEND_URL=http://localhost:3000
```

### 3. Backend

```bash
cd backend
npm install
cp .env.example .env
# .env içine GROQ_API_KEY değerini girin
npm run dev
```

### 4. Supabase Tabloları

Supabase Dashboard → SQL Editor'de çalıştırın:

<details>
<summary>SQL şemasını göster</summary>

```sql
-- Profiller
create table profiles (
  id uuid references auth.users primary key,
  full_name text, phone text, birth_date text,
  updated_at timestamptz
);

-- İlaçlar
create table medicines (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null, dose text,
  days text[], times text[],
  note text, color text, icon text,
  created_at timestamptz default now()
);

-- İlaç alım logları
create table medicine_taken_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  medicine_id uuid references medicines not null,
  taken_date date not null,
  taken_at timestamptz default now(),
  unique(user_id, medicine_id, taken_date)
);

-- Planlar
create table plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text not null, plan_date date not null,
  plan_time text, note text,
  is_done boolean default false,
  created_at timestamptz default now()
);

-- Sağlık kayıtları
create table health_records (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  blood_pressure text, blood_sugar numeric,
  pulse integer, weight numeric, note text,
  recorded_at timestamptz default now()
);

-- Aile üyeleri
create table family_members (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null, relation text,
  birth_date text, phone text,
  color text, avatar text,
  created_at timestamptz default now()
);

-- Aile ilaçları
create table family_medicines (
  id uuid default gen_random_uuid() primary key,
  member_id uuid references family_members not null,
  user_id uuid references auth.users not null,
  name text not null, dose text,
  days text[], times text[], note text,
  created_at timestamptz default now()
);

-- Aile ilaç logları
create table family_medicine_logs (
  id uuid default gen_random_uuid() primary key,
  member_id uuid references family_members not null,
  medicine_id uuid references family_medicines not null,
  taken_date date not null,
  taken_at timestamptz default now(),
  unique(member_id, medicine_id, taken_date)
);

-- RLS politikaları (her tablo için tekrarlayın)
alter table medicines enable row level security;
create policy "Kullanıcı kendi verisini yönetir"
  on medicines for all using (auth.uid() = user_id);
```

</details>

**Realtime:** Supabase Dashboard → Database → Replication → şu tabloları aktif edin:
`medicines` · `plans` · `health_records` · `family_members` · `medicine_taken_logs`

### 5. Uygulamayı Başlat

```bash
npx expo start --dev-client --clear
```

---

## 🎙️ Sesli Komut Örnekleri

| Komut | Ne Yapar |
|-------|----------|
| `"Aspirin aldım"` | İlacı bugün alındı olarak işaretle |
| `"Anneyi ara"` | Aile üyesini telefon ile ara |
| `"Yarın saat 15'e doktor randevusu"` | Takvime plan ekle |
| `"İlaçlarıma git"` | İlaçlarım ekranını aç |
| `"Yeni ilaç ekle"` | Sesli ilaç ekleme sihirbazını başlat |
| `"Kan şekerim 120"` | Sağlık ölçümü kaydet |

---

## 🏛️ Mimari

**Global Data Hooks** — Her ekran merkezi `useData.js` hook'larını kullanır. Supabase sorguları tek yerden yönetilir, kod tekrarı yoktur.

**Realtime Senkronizasyon** — `useRealtimeTable` hook'u websocket kanalı açar. Başka cihazda yapılan değişiklik anlık yansır.

**Optimistic UI** — Aksiyonlar önce UI'da gösterilir, ardından DB'ye yazılır. Hata olursa otomatik geri alınır.

**Performance** — `React.memo` + `FlatList` + `useCallback/useMemo` kombinasyonu ile büyük listelerde akıcı deneyim.

---

## 🔐 Güvenlik

- Tüm anahtarlar `.env` dosyasında — kod içinde hardcoded değer yok
- RLS ile her kullanıcı yalnızca kendi verisine erişebilir
- Backend URL production'da tanımsızsa hata fırlatır — sessizce yanlış adrese düşmez
- `debug.keystore` ve `.env` dosyaları `.gitignore` ile korunuyor

---

## 📄 Lisans

MIT © [beyziki](https://github.com/beyziki)

<div align="center">
<br/>
<sub>🦯 Sağlıklı yaşam, teknoloji ile kolaylaşır</sub>
</div>