/**
 * CanBakım — ChatMessage
 * React.memo ile sarılmış — mesaj listesi büyüyünce performans korunur
 */
import { memo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { FONTS, RADIUS, SHADOW } from '../lib/theme'

const ChatMessage = memo(function ChatMessage({ msg, colors, isSpeaking, onSpeak }) {
  const isUser = msg.role === 'user'

  return (
    <View style={[styles.row, isUser && styles.rowUser]}>
      {!isUser && (
        <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
          <Text style={{ fontSize: 16 }}>🤖</Text>
        </View>
      )}
      <TouchableOpacity
        onPress={() => onSpeak(msg.content)}
        activeOpacity={0.85}
        style={[
          styles.bubble,
          isUser
            ? [styles.bubbleUser, { backgroundColor: colors.primary }]
            : [styles.bubbleAI, { backgroundColor: colors.card, borderColor: colors.border }],
          msg.isError && { borderColor: '#E05050', borderWidth: 1 },
        ]}
      >
        <Text style={[
          styles.text,
          isUser ? { color: 'white' } : { color: colors.text }
        ]}>
          {msg.content}
        </Text>
        <View style={styles.meta}>
          <Text style={[styles.time, { color: isUser ? 'rgba(255,255,255,0.7)' : colors.textMuted }]}>
            {msg.time}
          </Text>
          {!isUser && (
            <Text style={[styles.speakHint, { color: colors.textMuted }]}>
              {isSpeaking ? '🔊' : '👆 Sesli dinle'}
            </Text>
          )}
        </View>
      </TouchableOpacity>
      {isUser && (
        <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
          <Text style={{ fontSize: 16 }}>👤</Text>
        </View>
      )}
    </View>
  )
}, (prev, next) => {
  // Mesaj içeriği ve konuşma durumu değişmediği sürece re-render yok
  return prev.msg.id === next.msg.id &&
         prev.isSpeaking === next.isSpeaking &&
         prev.colors === next.colors
})

export default ChatMessage

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 },
  rowUser: { flexDirection: 'row-reverse' },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  bubble: { maxWidth: '78%', borderRadius: RADIUS.lg, padding: 14, ...SHADOW.sm },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleAI: { borderBottomLeftRadius: 4, borderWidth: 1 },
  text: { fontSize: FONTS.sm, lineHeight: 22 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, gap: 8 },
  time: { fontSize: 11, fontWeight: '600' },
  speakHint: { fontSize: 10, fontWeight: '600' },
})