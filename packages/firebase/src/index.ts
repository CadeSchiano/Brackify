import { getApp, getApps, initializeApp } from 'firebase/app'
import { addDoc, collection, doc, getDoc, getFirestore, onSnapshot, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'
import type { User } from 'firebase/auth'

export const firebaseConfig = {
  apiKey: 'AIzaSyD-7wJ6vd8k8N_ggYyc9Vi0ws9ZVK_KfTQ',
  authDomain: 'brackify-25fe2.firebaseapp.com',
  projectId: 'brackify-25fe2',
  storageBucket: 'brackify-25fe2.firebasestorage.app',
  messagingSenderId: '86097795467',
  appId: '1:86097795467:web:e501352ad976d8d91fb78e',
  measurementId: 'G-XZWTHCWMB7',
}

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const db = getFirestore(firebaseApp)

export type UserProfile = {
  id: string
  name: string
  username: string
  photoUrl: string
  favoriteColor: string
  bio: string
  onboardingComplete: boolean
}

const defaultProfile = (user: User): UserProfile => ({
  id: user.uid,
  name: user.displayName || '',
  username: '',
  photoUrl: user.photoURL || '',
  favoriteColor: '#5263F5',
  bio: '',
  onboardingComplete: false,
})

export async function ensureUserProfile(user: User) {
  const ref = doc(db, 'users', user.uid)
  const snapshot = await getDoc(ref)
  if (snapshot.exists()) return snapshot.data() as UserProfile
  const profile = defaultProfile(user)
  await setDoc(ref, { ...profile, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  return profile
}

export async function saveUserProfile(userId: string, profile: Omit<UserProfile, 'id'>) {
  await updateDoc(doc(db, 'users', userId), { ...profile, updatedAt: serverTimestamp() })
  return { id: userId, ...profile } as UserProfile
}

export function subscribeToUserProfile(userId: string, onChange: (profile: UserProfile | null) => void) {
  return onSnapshot(doc(db, 'users', userId), snapshot => onChange(snapshot.exists() ? snapshot.data() as UserProfile : null))
}

export type StoredTournament = {
  id: string
  name: string
  description: string
  game: string
  location: string
  date: string
  format: string
  visibility: 'private' | 'public'
  organizerId: string
  memberIds: string[]
  maxTeams: number
  playerNames: string[]
  inviteCode: string
  imageUrl?: string
  passwordProtected?: boolean
}

export type CreateTournamentInput = Omit<StoredTournament, 'id' | 'organizerId' | 'memberIds' | 'inviteCode'>

const inviteCode = () => Array.from({ length: 8 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('')

export async function createTournament(userId: string, input: CreateTournamentInput) {
  const code = inviteCode()
  const ref = await addDoc(collection(db, 'tournaments'), {
    ...input,
    inviteCode: code,
    organizerId: userId,
    memberIds: [userId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  await setDoc(doc(db, 'invites', code), { tournamentId: ref.id, organizerId: userId, createdAt: serverTimestamp() })
  await seedTournamentPlayers(ref.id, input.playerNames)
  return { id: ref.id, ...input, inviteCode: code, organizerId: userId, memberIds: [userId] } as StoredTournament
}

export async function updateTournament(tournamentId: string, updates: Partial<Omit<StoredTournament, 'id' | 'organizerId' | 'memberIds' | 'inviteCode'>>) {
  await updateDoc(doc(db, 'tournaments', tournamentId), { ...updates, updatedAt: serverTimestamp() })
}

export async function joinTournamentByCode(userId: string, rawCode: string) {
  const code = rawCode.trim().toUpperCase()
  const invitation = await getDoc(doc(db, 'invites', code))
  if (!invitation.exists()) throw new Error('Invite code not found.')
  const tournamentId = String(invitation.data().tournamentId)
  const tournamentRef = doc(db, 'tournaments', tournamentId)
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(tournamentRef)
    if (!snapshot.exists()) throw new Error('Tournament no longer exists.')
    const tournament = snapshot.data() as StoredTournament
    if (tournament.memberIds.includes(userId)) return
    transaction.update(tournamentRef, { memberIds: [...tournament.memberIds, userId], lastJoinCode: code, updatedAt: serverTimestamp() })
  })
  return tournamentId
}

export function subscribeToTournaments(userId: string, onChange: (tournaments: StoredTournament[]) => void, onError: (error: Error) => void) {
  const memberships = query(collection(db, 'tournaments'), where('memberIds', 'array-contains', userId))
  return onSnapshot(memberships, snapshot => onChange(snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as StoredTournament)), onError)
}

export type TournamentPlayer = { id: string; name: string; checkedIn: boolean }
export type StoredTeam = { id: string; name: string; color: string; playerIds: string[] }

const playersRef = (tournamentId: string) => collection(db, 'tournaments', tournamentId, 'players')
const teamsRef = (tournamentId: string) => collection(db, 'tournaments', tournamentId, 'teams')

export async function seedTournamentPlayers(tournamentId: string, names: string[]) {
  const batch = writeBatch(db)
  names.forEach((name, index) => batch.set(doc(playersRef(tournamentId), `player-${index + 1}`), { name, checkedIn: false, createdAt: serverTimestamp() }))
  await batch.commit()
}

export async function addTournamentPlayer(tournamentId: string, name: string) {
  const ref = await addDoc(playersRef(tournamentId), { name: name.trim(), checkedIn: false, createdAt: serverTimestamp() })
  return { id: ref.id, name: name.trim(), checkedIn: false } as TournamentPlayer
}

export function subscribeToPlayers(tournamentId: string, onChange: (players: TournamentPlayer[]) => void) {
  return onSnapshot(playersRef(tournamentId), snapshot => onChange(snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as TournamentPlayer)))
}

export async function saveTeams(tournamentId: string, teams: StoredTeam[]) {
  const batch = writeBatch(db)
  teams.forEach(team => batch.set(doc(teamsRef(tournamentId), team.id), { ...team, updatedAt: serverTimestamp() }))
  await batch.commit()
}

export function subscribeToTeams(tournamentId: string, onChange: (teams: StoredTeam[]) => void) {
  return onSnapshot(teamsRef(tournamentId), snapshot => onChange(snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as StoredTeam)))
}

export type TournamentMatch = {
  id: string
  round: number
  position: number
  teamAId: string | null
  teamBId: string | null
  scoreA: number | null
  scoreB: number | null
  winnerId: string | null
  nextMatchId: string | null
  nextSlot: 'teamAId' | 'teamBId' | null
  loserNextMatchId?: string | null
  loserNextSlot?: 'teamAId' | 'teamBId' | null
}

const matchesRef = (tournamentId: string) => collection(db, 'tournaments', tournamentId, 'matches')

export async function generateSingleEliminationBracket(tournamentId: string, teams: StoredTeam[]) {
  if (teams.length < 2 || (teams.length & (teams.length - 1)) !== 0) throw new Error('Single elimination requires 2, 4, or 8 teams.')
  const rounds = Math.log2(teams.length)
  const batch = writeBatch(db)
  for (let round = 1; round <= rounds; round += 1) {
    const matchCount = teams.length / 2 ** round
    for (let position = 1; position <= matchCount; position += 1) {
      const id = `r${round}-m${position}`
      const nextMatchId = round < rounds ? `r${round + 1}-m${Math.ceil(position / 2)}` : null
      const nextSlot = round < rounds ? (position % 2 ? 'teamAId' : 'teamBId') : null
      batch.set(doc(matchesRef(tournamentId), id), {
        round, position,
        teamAId: round === 1 ? teams[(position - 1) * 2].id : null,
        teamBId: round === 1 ? teams[(position - 1) * 2 + 1].id : null,
        scoreA: null, scoreB: null, winnerId: null, nextMatchId, nextSlot,
        loserNextMatchId: null, loserNextSlot: null,
        updatedAt: serverTimestamp(),
      })
    }
  }
  await batch.commit()
}

export async function generateDoubleEliminationBracket(tournamentId: string, teams: StoredTeam[]) {
  if (teams.length !== 4) throw new Error('Double elimination currently supports 4 teams.')
  const batch = writeBatch(db)
  const write = (id: string, data: Partial<TournamentMatch>) => batch.set(doc(matchesRef(tournamentId), id), { scoreA: null, scoreB: null, winnerId: null, nextMatchId: null, nextSlot: null, loserNextMatchId: null, loserNextSlot: null, updatedAt: serverTimestamp(), ...data })
  write('w-r1-m1', { round: 1, position: 1, teamAId: teams[0].id, teamBId: teams[1].id, nextMatchId: 'w-r2-m1', nextSlot: 'teamAId', loserNextMatchId: 'l-r1-m1', loserNextSlot: 'teamAId' })
  write('w-r1-m2', { round: 1, position: 2, teamAId: teams[2].id, teamBId: teams[3].id, nextMatchId: 'w-r2-m1', nextSlot: 'teamBId', loserNextMatchId: 'l-r1-m1', loserNextSlot: 'teamBId' })
  write('l-r1-m1', { round: 2, position: 1, teamAId: null, teamBId: null, nextMatchId: 'l-r2-m1', nextSlot: 'teamAId' })
  write('w-r2-m1', { round: 2, position: 2, teamAId: null, teamBId: null, nextMatchId: 'g-m1', nextSlot: 'teamAId', loserNextMatchId: 'l-r2-m1', loserNextSlot: 'teamBId' })
  write('l-r2-m1', { round: 3, position: 1, teamAId: null, teamBId: null, nextMatchId: 'g-m1', nextSlot: 'teamBId' })
  write('g-m1', { round: 4, position: 1, teamAId: null, teamBId: null })
  await batch.commit()
}

export async function generateRoundRobinSchedule(tournamentId: string, teams: StoredTeam[]) {
  if (teams.length < 2 || teams.length % 2 !== 0) throw new Error('Round robin requires an even number of teams.')
  const rotation = [...teams]
  const batch = writeBatch(db)
  for (let round = 1; round < teams.length; round += 1) {
    for (let position = 0; position < teams.length / 2; position += 1) {
      const id = `rr-r${round}-m${position + 1}`
      batch.set(doc(matchesRef(tournamentId), id), {
        round, position: position + 1,
        teamAId: rotation[position].id,
        teamBId: rotation[rotation.length - 1 - position].id,
        scoreA: null, scoreB: null, winnerId: null, nextMatchId: null, nextSlot: null,
        updatedAt: serverTimestamp(),
      })
    }
    rotation.splice(1, 0, rotation.pop()!)
  }
  await batch.commit()
}

export function subscribeToMatches(tournamentId: string, onChange: (matches: TournamentMatch[]) => void) {
  return onSnapshot(matchesRef(tournamentId), snapshot => onChange(snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as TournamentMatch).sort((a, b) => a.round - b.round || a.position - b.position)))
}

export async function recordMatchResult(tournamentId: string, matchId: string, scoreA: number, scoreB: number) {
  if (scoreA === scoreB) throw new Error('A winner is required.')
  await runTransaction(db, async transaction => {
    const matchRef = doc(matchesRef(tournamentId), matchId)
    const snapshot = await transaction.get(matchRef)
    if (!snapshot.exists()) throw new Error('Match not found.')
    const match = { id: snapshot.id, ...snapshot.data() } as TournamentMatch
    if (!match.teamAId || !match.teamBId) throw new Error('Both teams must be set before scoring.')
    const winnerId = scoreA > scoreB ? match.teamAId : match.teamBId
    transaction.update(matchRef, { scoreA, scoreB, winnerId, updatedAt: serverTimestamp() })
    if (match.nextMatchId && match.nextSlot) transaction.update(doc(matchesRef(tournamentId), match.nextMatchId), { [match.nextSlot]: winnerId, updatedAt: serverTimestamp() })
    const loserId = winnerId === match.teamAId ? match.teamBId : match.teamAId
    if (match.loserNextMatchId && match.loserNextSlot) transaction.update(doc(matchesRef(tournamentId), match.loserNextMatchId), { [match.loserNextSlot]: loserId, updatedAt: serverTimestamp() })
  })
}
