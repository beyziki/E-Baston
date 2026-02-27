import { useState, useEffect, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, Alert, Modal, Animated
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '../lib/supabase'
import { FONTS, RADIUS, SHADOW } from '../lib/theme'
import { useTheme } from '../lib/ThemeContext'
import { SpeakablePress, SpeechToggleButton } from '../lib/SpeechContext'

const RELATIONS = ['Anne', 'Baba', 'Eş', 'Çocuk', 'Kardeş', 'Büyükanne', 'Büyükbaba', 'Diğer']
const MEMBER_AVATARS = ['👩', '👨', '💑', '👶', '🧑', '👵', '👴', '🧑']
const MEMBER_COLORS = ['#E07B4F', '#4361EE', '#E05050', '#06D6A0', '#7209B7', '#F0A500', '#4CC9F0', '#6B5B8E']
const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const TODAY = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]

function AnimatedCard({ children, delay = 0, style }) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 500, delay, useNativeDriver: true }).start()
  }, [])
  return (
    <Animated.View style={[{
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
    }, style]}>
      {children}
    </Animated.View>
  )
}

export default function FamilyScreen() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showMedModal, setShowMedModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [memberMeds, setMemberMeds] = useState([])
  const [memberTakenIds, setMemberTakenIds] = useState([])

  // Üye ekleme form
  const [name, setName] = useState('')
  const [relation, setRelation] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [phone, setPhone] = useState('')

  // İlaç ekleme form
  const [medName, setMedName] = useState('')
  const [medDose, setMedDose] = useState('')
  const [medDays, setMedDays] = useState([])
  const [medTimes, setMedTimes] = useState('')
  const [medNote, setMedNote] = useState('')
  const [showMedAddForm, setShowMedAddForm] = useState(false)

  const { colors } = useTheme()
  const todayStr = new Date().toISOString().split('T')[0]

  useEffect(() => { fetchMembers() }, [])

  async function fetchMembers() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('family_members').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: true })
    if (!error) setMembers(data || [])
    setLoading(false)
  }

  async function addMember() {
    if (!name.trim() || !relation) { Alert.alert('Hata', 'İsim ve ilişki seçiniz'); return }
    const { data: { user } } = await supabase.auth.getUser()
    const idx = members.length % MEMBER_COLORS.length
    const { error } = await supabase.from('family_members').insert({
      user_id: user.id,
      name: name.trim(),
      relation,
      birth_date: birthDate || null,
      phone: phone || null,
      color: MEMBER_COLORS[idx],
      avatar: MEMBER_AVATARS[RELATIONS.indexOf(relation)] || '🧑',
    })
    if (error) { Alert.alert('Hata', error.message); return }
    setName(''); setRelation(''); setBirthDate(''); setPhone('')
    setShowAddModal(false)
    fetchMembers()
  }

  async function deleteMember(id) {
    Alert.alert('Üyeyi Sil', 'Bu aile üyesini ve tüm ilaçlarını silmek istiyor musunuz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
        // Önce ilaçları sil
        await supabase.from('family_medicines').delete().eq('member_id', id)
        await supabase.from('family_members').delete().eq('id', id)
        fetchMembers()
      }}
    ])
  }

  // Üye detay modalını aç
  async function openMemberDetail(member) {
    setSelectedMember(member)
    setShowMedModal(true)
    await fetchMemberMeds(member.id)
  }

  async function fetchMemberMeds(memberId) {
    const [medsRes, logsRes] = await Promise.all([
      supabase.from('family_medicines').select('*').eq('member_id', memberId).order('created_at'),
      supabase.from('family_medicine_logs').select('medicine_id')
        .eq('member_id', memberId).eq('taken_date', todayStr),
    ])
    setMemberMeds(medsRes.data || [])
    setMemberTakenIds((logsRes.data || []).map(l => l.medicine_id))
  }

  async function addMemberMedicine() {
    if (!medName.trim()) { Alert.alert('Hata', 'İlaç adı giriniz'); return }
    if (!medDays.length) { Alert.alert('Hata', 'En az bir gün seçiniz'); return }

    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('family_medicines').insert({
      member_id: selectedMember.id,
      user_id: user.id,
      name: medName.trim(),
      dose: medDose.trim() || null,
      days: medDays,
      times: medTimes ? medTimes.split(',').map(t => t.trim()) : ['08:00'],
      note: medNote.trim() || null,
    })

    if (error) { Alert.alert('Hata', error.message); return }
    setMedName(''); setMedDose(''); setMedDays([]); setMedTimes(''); setMedNote('')
    setShowMedAddForm(false)
    fetchMemberMeds(selectedMember.id)
  }

  async function deleteMemberMedicine(medId) {
    await supabase.from('family_medicines').delete().eq('id', medId)
    fetchMemberMeds(selectedMember.id)
  }

  async function markMemberMedicineTaken(med) {
    if (memberTakenIds.includes(med.id)) return

    setMemberTakenIds(prev => [...prev, med.id])
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('family_medicine_logs').upsert({
      member_id: selectedMember.id,
      user_id: user.id,
      medicine_id: med.id,
      taken_date: todayStr,
      taken_at: new Date().toISOString(),
    }, { onConflict: 'member_id,medicine_id,taken_date' })
  }

  function toggleMedDay(day) {
    setMedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  function getAge(birthDate) {
    if (!birthDate) return null
    const parts = birthDate.split('.')
    if (parts.length === 3) {
      const birth = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
      const age = Math.floor((new Date() - birth) / (365.25 * 24 * 60 * 60 * 1000))
      return isNaN(age) ? null : age
    }
    return null
  }

  const s = makeStyles(colors)

  if (loading) return (
    <LinearGradient colors={['#4361EE', '#7209B7']} style={s.loadingScreen}>
      <Text style={s.loadingText}>👨‍👩‍👧 Aile yükleniyor...</Text>
    </LinearGradient>
  )

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* HEADER */}
        <AnimatedCard delay={0}>
          <LinearGradient colors={['#4361EE', '#7209B7', '#4CC9F0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.headerCard}>
            <View style={s.circle1} /><View style={s.circle2} />
            <View style={s.headerTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.headerLabel}>Aile Takibi</Text>
                <Text style={s.headerTitle}>👨‍👩‍👧 Ailem</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 8 }}>
                <SpeakablePress text={`${members.length} aile üyesi`} speakOnly style={s.headerBadge}>
                  <Text style={s.headerBadgeNum}>{members.length}</Text>
                  <Text style={s.headerBadgeLabel}>Üye</Text>
                </SpeakablePress>
                <SpeechToggleButton />
              </View>
            </View>
          </LinearGradient>
        </AnimatedCard>

        {/* ÜYELER */}
        {members.length === 0 ? (
          <AnimatedCard delay={100}>
            <View style={[s.emptyCard, { backgroundColor: colors.card }]}>
              <Text style={{ fontSize: 48 }}>👨‍👩‍👧</Text>
              <Text style={[s.emptyTitle, { color: colors.text }]}>Henüz aile üyesi yok</Text>
              <Text style={[s.emptySub, { color: colors.textMuted }]}>
                Sevdiklerinizin ilaç ve sağlık takibini buradan yapabilirsiniz.
              </Text>
            </View>
          </AnimatedCard>
        ) : (
          members.map((member, index) => {
            const age = getAge(member.birth_date)
            return (
              <AnimatedCard key={member.id} delay={100 + index * 80}>
                <TouchableOpacity
                  onPress={() => openMemberDetail(member)}
                  style={[s.memberCard, { backgroundColor: colors.card }]}
                  activeOpacity={0.8}
                >
                  {/* Renk çubuğu */}
                  <View style={[s.memberColorBar, { backgroundColor: member.color }]} />

                  <View style={s.memberContent}>
                    <View style={[s.memberAvatar, { backgroundColor: member.color + '25' }]}>
                      <Text style={{ fontSize: 28 }}>{member.avatar}</Text>
                    </View>

                    <View style={s.memberInfo}>
                      <Text style={[s.memberName, { color: colors.text }]}>{member.name}</Text>
                      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                        <View style={[s.tag, { backgroundColor: member.color + '20' }]}>
                          <Text style={[s.tagText, { color: member.color }]}>{member.relation}</Text>
                        </View>
                        {age && (
                          <View style={[s.tag, { backgroundColor: colors.border }]}>
                            <Text style={[s.tagText, { color: colors.textMid }]}>{age} yaş</Text>
                          </View>
                        )}
                        {member.phone && (
                          <View style={[s.tag, { backgroundColor: colors.successSoft }]}>
                            <Text style={[s.tagText, { color: colors.success }]}>📞 {member.phone}</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={{ alignItems: 'flex-end', gap: 8 }}>
                      <Text style={{ fontSize: 22, color: colors.textMuted }}>›</Text>
                      <TouchableOpacity
                        onPress={() => deleteMember(member.id)}
                        style={[s.deleteBtn, { backgroundColor: colors.dangerSoft }]}
                      >
                        <Text style={{ fontSize: 14 }}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              </AnimatedCard>
            )
          })
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity onPress={() => setShowAddModal(true)} style={s.fab}>
        <LinearGradient colors={['#4361EE', '#7209B7']} style={s.fabGradient}>
          <Text style={s.fabText}>+ Aile Üyesi Ekle</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* ── ÜYE EKLEME MODALI ────────────────────────────────── */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={[s.modal, { backgroundColor: colors.card }]}>
            <LinearGradient colors={['#4361EE', '#7209B7']} style={s.modalHeader}>
              <Text style={s.modalTitle}>👤 Yeni Aile Üyesi</Text>
            </LinearGradient>
            <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              <Text style={[s.label, { color: colors.textMuted }]}>İsim *</Text>
              <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                placeholder="Adı Soyadı" placeholderTextColor={colors.textMuted}
                value={name} onChangeText={setName} />

              <Text style={[s.label, { color: colors.textMuted }]}>İlişki *</Text>
              <View style={s.relationGrid}>
                {RELATIONS.map(r => (
                  <TouchableOpacity key={r} onPress={() => setRelation(r)}
                    style={[s.relationBtn,
                      { backgroundColor: colors.border },
                      relation === r && { backgroundColor: '#4361EE' }
                    ]}>
                    <Text style={[s.relationBtnText, { color: colors.textMid }, relation === r && { color: 'white' }]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[s.label, { color: colors.textMuted }]}>Doğum Tarihi</Text>
              <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                placeholder="GG.AA.YYYY" placeholderTextColor={colors.textMuted}
                value={birthDate} onChangeText={setBirthDate} />

              <Text style={[s.label, { color: colors.textMuted }]}>Telefon</Text>
              <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                placeholder="05XX XXX XX XX" placeholderTextColor={colors.textMuted}
                value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

              <TouchableOpacity onPress={addMember} style={s.btnSave}>
                <LinearGradient colors={['#4361EE', '#7209B7']} style={s.btnGradient}>
                  <Text style={s.btnSaveText}>✅ Ekle</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={s.btnCancel}>
                <Text style={[s.btnCancelText, { color: colors.textMuted }]}>İptal</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── ÜYE DETAY / İLAÇ TAKIP MODALI ─────────────────────── */}
      <Modal visible={showMedModal} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={[s.modal, { backgroundColor: colors.card }]}>
            {selectedMember && (
              <>
                <LinearGradient
                  colors={[selectedMember.color, selectedMember.color + 'AA']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={s.modalHeader}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ fontSize: 28 }}>{selectedMember.avatar}</Text>
                    <View>
                      <Text style={s.modalTitle}>{selectedMember.name}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: FONTS.xs }}>
                        {selectedMember.relation}
                        {getAge(selectedMember.birth_date) ? ` • ${getAge(selectedMember.birth_date)} yaş` : ''}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>

                <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
                  {/* Bugünkü ilaçlar */}
                  <Text style={[s.sectionTitle, { color: colors.text }]}>
                    💊 Bugünkü İlaçlar ({TODAY})
                  </Text>

                  {memberMeds.filter(m => m.days?.includes(TODAY)).length === 0 ? (
                    <View style={[s.emptyMedBox, { backgroundColor: colors.border + '50' }]}>
                      <Text style={{ color: colors.textMuted, fontSize: FONTS.sm }}>
                        Bugün için ilaç planlanmamış
                      </Text>
                    </View>
                  ) : (
                    memberMeds.filter(m => m.days?.includes(TODAY)).map(med => {
                      const isTaken = memberTakenIds.includes(med.id)
                      return (
                        <View key={med.id} style={[s.medRow, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                          <View style={s.medRowLeft}>
                            <Text style={{ fontSize: 20 }}>💊</Text>
                            <View>
                              <Text style={[s.medName, { color: colors.text }]}>{med.name}</Text>
                              {med.dose && <Text style={[s.medDose, { color: colors.textMuted }]}>{med.dose}</Text>}
                              {med.times && <Text style={[s.medTimes, { color: colors.secondary }]}>🕐 {med.times.join(' • ')}</Text>}
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={() => markMemberMedicineTaken(med)}
                            style={[s.takenBtn, { backgroundColor: colors.border }, isTaken && { backgroundColor: colors.success }]}
                          >
                            <Text style={{ fontSize: 16, color: isTaken ? 'white' : colors.textMuted }}>
                              {isTaken ? '✅' : '○'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )
                    })
                  )}

                  {/* Tüm ilaçlar */}
                  <View style={[s.divider, { borderColor: colors.border }]} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={[s.sectionTitle, { color: colors.text, marginBottom: 0 }]}>
                      📋 Tüm İlaçlar ({memberMeds.length})
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowMedAddForm(!showMedAddForm)}
                      style={[s.addMedBtn, { backgroundColor: colors.primarySoft }]}
                    >
                      <Text style={[s.addMedBtnText, { color: colors.primary }]}>
                        {showMedAddForm ? '✕ Kapat' : '+ İlaç Ekle'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* İlaç ekleme formu */}
                  {showMedAddForm && (
                    <View style={[s.medAddForm, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                      <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                        placeholder="İlaç adı *" placeholderTextColor={colors.textMuted}
                        value={medName} onChangeText={setMedName} />
                      <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                        placeholder="Doz (örn: 500mg)" placeholderTextColor={colors.textMuted}
                        value={medDose} onChangeText={setMedDose} />
                      <Text style={[s.label, { color: colors.textMuted }]}>Günler *</Text>
                      <View style={s.daysRow}>
                        {DAYS.map(d => (
                          <TouchableOpacity key={d} onPress={() => toggleMedDay(d)}
                            style={[s.dayBtn, { backgroundColor: colors.border },
                              medDays.includes(d) && { backgroundColor: selectedMember.color }
                            ]}>
                            <Text style={[s.dayBtnText, { color: colors.textMid },
                              medDays.includes(d) && { color: 'white' }
                            ]}>{d}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                        placeholder="Saatler (örn: 08:00, 20:00)" placeholderTextColor={colors.textMuted}
                        value={medTimes} onChangeText={setMedTimes} />
                      <TextInput style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                        placeholder="Not (isteğe bağlı)" placeholderTextColor={colors.textMuted}
                        value={medNote} onChangeText={setMedNote} />
                      <TouchableOpacity onPress={addMemberMedicine}
                        style={[s.saveMedBtn, { backgroundColor: selectedMember.color }]}>
                        <Text style={s.saveMedBtnText}>💾 Kaydet</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* İlaç listesi */}
                  {memberMeds.map(med => (
                    <View key={med.id} style={[s.medListRow, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                      <Text style={{ fontSize: 18 }}>💊</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.medName, { color: colors.text }]}>{med.name}</Text>
                        {med.dose && <Text style={[s.medDose, { color: colors.textMuted }]}>{med.dose}</Text>}
                        <Text style={[s.medDose, { color: colors.textMuted }]}>
                          {med.days?.join(', ')} • {med.times?.join(', ')}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => deleteMemberMedicine(med.id)}
                        style={[s.deleteSmall, { backgroundColor: colors.dangerSoft }]}>
                        <Text style={{ fontSize: 12 }}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  <TouchableOpacity
                    onPress={() => { setShowMedModal(false); setShowMedAddForm(false) }}
                    style={[s.btnCancel, { marginTop: 16 }]}
                  >
                    <Text style={[s.btnCancelText, { color: colors.textMuted }]}>Kapat</Text>
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  )
}

const makeStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, paddingBottom: 100 },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: 'white', fontSize: 18, fontWeight: '700' },
  headerCard: { borderRadius: RADIUS.lg, padding: 22, marginBottom: 16, overflow: 'hidden', ...SHADOW.lg },
  circle1: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.08)', top: -50, right: -40 },
  circle2: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.06)', bottom: -20, left: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLabel: { fontSize: FONTS.xs, color: 'rgba(255,255,255,0.75)', fontWeight: '600', marginBottom: 4 },
  headerTitle: { fontSize: FONTS.xl, fontWeight: '900', color: 'white' },
  headerBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.md, padding: 12, alignItems: 'center', minWidth: 60 },
  headerBadgeNum: { fontSize: FONTS.xl, fontWeight: '900', color: 'white' },
  headerBadgeLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  emptyCard: { borderRadius: RADIUS.lg, padding: 32, alignItems: 'center', marginBottom: 14, ...SHADOW.md },
  emptyTitle: { fontSize: FONTS.md, fontWeight: '800', marginTop: 12 },
  emptySub: { fontSize: FONTS.sm, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  memberCard: { borderRadius: RADIUS.lg, marginBottom: 12, overflow: 'hidden', ...SHADOW.md, flexDirection: 'row' },
  memberColorBar: { width: 6 },
  memberContent: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  memberAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: FONTS.md, fontWeight: '800' },
  tag: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 11, fontWeight: '700' },
  deleteBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', bottom: 24, right: 24, borderRadius: 30, overflow: 'hidden', ...SHADOW.lg },
  fabGradient: { paddingHorizontal: 24, paddingVertical: 14 },
  fabText: { color: 'white', fontSize: FONTS.sm, fontWeight: '800' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '90%', overflow: 'hidden' },
  modalHeader: { padding: 20, alignItems: 'center' },
  modalTitle: { fontSize: FONTS.lg, fontWeight: '800', color: 'white' },
  label: { fontSize: FONTS.xs, fontWeight: '700', marginBottom: 6, marginTop: 4 },
  input: { borderRadius: RADIUS.md, padding: 13, fontSize: FONTS.sm, marginBottom: 10, borderWidth: 1.5 },
  relationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  relationBtn: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  relationBtnText: { fontSize: FONTS.xs, fontWeight: '700' },
  btnSave: { borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: 8 },
  btnGradient: { padding: 15, alignItems: 'center' },
  btnSaveText: { color: 'white', fontSize: FONTS.md, fontWeight: '800' },
  btnCancel: { alignItems: 'center', padding: 12 },
  btnCancelText: { fontSize: FONTS.sm, fontWeight: '700' },
  sectionTitle: { fontSize: FONTS.sm, fontWeight: '800', marginBottom: 10 },
  emptyMedBox: { borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10 },
  medRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1 },
  medRowLeft: { flexDirection: 'row', gap: 10, alignItems: 'center', flex: 1 },
  medName: { fontSize: FONTS.sm, fontWeight: '800' },
  medDose: { fontSize: FONTS.xs, marginTop: 1 },
  medTimes: { fontSize: FONTS.xs, fontWeight: '700', marginTop: 1 },
  takenBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  divider: { borderTopWidth: 1, marginVertical: 14 },
  addMedBtn: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 },
  addMedBtnText: { fontSize: FONTS.xs, fontWeight: '800' },
  medAddForm: { borderRadius: 14, padding: 12, borderWidth: 1, marginBottom: 12 },
  daysRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  dayBtn: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  dayBtnText: { fontSize: 11, fontWeight: '700' },
  saveMedBtn: { borderRadius: 12, padding: 12, alignItems: 'center' },
  saveMedBtnText: { color: 'white', fontSize: FONTS.sm, fontWeight: '800' },
  medListRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, padding: 10, marginBottom: 6, borderWidth: 1 },
  deleteSmall: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
})