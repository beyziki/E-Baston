export default {
  expo: {
    name: 'E-Baston',
    slug: 'e-baston',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#4361EE',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.ebaston.app',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#4361EE',
      },
      package: 'com.ebaston.app',
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      // .env dosyasından okunur — bu değerler GitHub'a gitmez
      supabaseUrl:  process.env.SUPABASE_URL,
      supabaseKey:  process.env.SUPABASE_ANON_KEY,
      backendUrl:   process.env.BACKEND_URL || 'http://localhost:3000',
    },
  },
}