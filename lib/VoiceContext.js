import { createContext, useContext, useState } from 'react'

// Hangi ses modülünün aktif olduğunu global olarak yönetir
// 'global' = GlobalVoiceAssistant, 'medicine' = VoiceMedicineAdd, null = hiçbiri
const VoiceContext = createContext(null)

export function VoiceProvider({ children }) {
  const [activeVoiceModule, setActiveVoiceModule] = useState(null)

  return (
    <VoiceContext.Provider value={{ activeVoiceModule, setActiveVoiceModule }}>
      {children}
    </VoiceContext.Provider>
  )
}

export function useVoice() {
  return useContext(VoiceContext)
}