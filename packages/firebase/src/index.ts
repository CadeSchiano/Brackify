/// <reference path="./duel.d.ts" />
import { getApp, getApps, initializeApp } from 'firebase/app'
import { addDoc, arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, getFirestore, onSnapshot, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import Duel from 'duel'

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

/** Removes the signed-in user's Firestore profile and tournament data before their Auth account is deleted. */
export async function deleteAccountData(userId: string) {
  const memberships = await getDocs(query(collection(db, 'tournaments'), where('memberIds', 'array-contains', userId)))

  for (const tournamentSnapshot of memberships.docs) {
    const tournament = { id: tournamentSnapshot.id, ...tournamentSnapshot.data() } as StoredTournament
    if (tournament.organizerId !== userId) {
      await updateDoc(tournamentSnapshot.ref, { memberIds: arrayRemove(userId), updatedAt: serverTimestamp() })
      continue
    }

    const [players, teams, matches] = await Promise.all([
      getDocs(collection(db, 'tournaments', tournament.id, 'players')),
      getDocs(collection(db, 'tournaments', tournament.id, 'teams')),
      getDocs(collection(db, 'tournaments', tournament.id, 'matches')),
    ])
    const batch = writeBatch(db)
    players.docs.forEach(item => batch.delete(item.ref))
    teams.docs.forEach(item => batch.delete(item.ref))
    matches.docs.forEach(item => batch.delete(item.ref))
    batch.delete(tournamentSnapshot.ref)
    batch.delete(doc(db, 'invites', tournament.inviteCode))
    await batch.commit()
  }

  const cleanup = writeBatch(db)
  cleanup.delete(doc(db, 'users', userId))
  await cleanup.commit()
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
  rosterInitialized?: boolean
  inviteCode: string
  imageUrl?: string
  passwordProtected?: boolean
  status?: 'active' | 'completed'
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
    rosterInitialized: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  await setDoc(doc(db, 'invites', code), { tournamentId: ref.id, organizerId: userId, createdAt: serverTimestamp() })
  await seedTournamentPlayers(ref.id, input.playerNames)
  await updateDoc(ref, { rosterInitialized: true, updatedAt: serverTimestamp() })
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
  await updateDoc(tournamentRef, { memberIds: arrayUnion(userId), lastJoinCode: code, updatedAt: serverTimestamp() })
  return tournamentId
}

export function subscribeToTournaments(userId: string, onChange: (tournaments: StoredTournament[]) => void, onError: (error: Error) => void) {
  const memberships = query(collection(db, 'tournaments'), where('memberIds', 'array-contains', userId))
  return onSnapshot(memberships, snapshot => onChange(snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as StoredTournament).filter(item => item.status !== 'completed')), onError)
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
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('Enter a player name.')
  const tournamentRef = doc(db, 'tournaments', tournamentId)
  const [tournamentSnapshot, rosterSnapshot] = await Promise.all([getDoc(tournamentRef), getDocs(playersRef(tournamentId))])
  if (!tournamentSnapshot.exists()) throw new Error('Tournament not found.')
  if (rosterSnapshot.docs.some(player => String(player.data().name).trim().toLocaleLowerCase() === trimmedName.toLocaleLowerCase())) throw new Error('That player is already on the roster.')
  const ref = doc(playersRef(tournamentId))
  const batch = writeBatch(db)
  batch.set(ref, { name: trimmedName, checkedIn: false, createdAt: serverTimestamp() })
  batch.update(tournamentRef, { playerNames: [...rosterSnapshot.docs.map(player => String(player.data().name)), trimmedName], rosterInitialized: true, updatedAt: serverTimestamp() })
  await batch.commit()
  return { id: ref.id, name: trimmedName, checkedIn: false } as TournamentPlayer
}

export async function removeTournamentPlayer(tournamentId: string, playerId: string) {
  const tournamentRef = doc(db, 'tournaments', tournamentId)
  const [tournamentSnapshot, playerSnapshot, teamsSnapshot, rosterSnapshot] = await Promise.all([getDoc(tournamentRef), getDoc(doc(playersRef(tournamentId), playerId)), getDocs(teamsRef(tournamentId)), getDocs(playersRef(tournamentId))])
  if (!tournamentSnapshot.exists() || !playerSnapshot.exists()) return
  const batch = writeBatch(db)
  batch.delete(playerSnapshot.ref)
  batch.update(tournamentRef, { playerNames: rosterSnapshot.docs.filter(player => player.id !== playerId).map(player => String(player.data().name)), rosterInitialized: true, updatedAt: serverTimestamp() })
  teamsSnapshot.docs.forEach(team => {
    const playerIds = (team.data().playerIds || []).filter((id: string) => id !== playerId)
    batch.update(team.ref, { playerIds, updatedAt: serverTimestamp() })
  })
  await batch.commit()
}

export function subscribeToPlayers(tournamentId: string, onChange: (players: TournamentPlayer[]) => void) {
  return onSnapshot(playersRef(tournamentId), snapshot => onChange(snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as TournamentPlayer)))
}

export async function saveTeams(tournamentId: string, teams: StoredTeam[]) {
  const batch = writeBatch(db)
  teams.forEach(team => batch.set(doc(teamsRef(tournamentId), team.id), { ...team, updatedAt: serverTimestamp() }))
  await batch.commit()
}

export async function deleteTournamentTeams(tournamentId: string) {
  const snapshot = await getDocs(teamsRef(tournamentId))
  const batch = writeBatch(db)
  snapshot.docs.forEach(team => batch.delete(team.ref))
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
  teamAName?: string | null
  teamBName?: string | null
  teamAColor?: string | null
  teamBColor?: string | null
  scoreA: number | null
  scoreB: number | null
  winnerId: string | null
  nextMatchId: string | null
  nextSlot: 'teamAId' | 'teamBId' | null
  loserNextMatchId?: string | null
  loserNextSlot?: 'teamAId' | 'teamBId' | null
  requiresResetOnLowerWinner?: boolean
}

const matchesRef = (tournamentId: string) => collection(db, 'tournaments', tournamentId, 'matches')

export async function generateSingleEliminationBracket(tournamentId: string, teams: StoredTeam[]) {
  if (teams.length < 2) throw new Error('Single elimination requires at least two teams.')
  const bracketSize = 2 ** Math.ceil(Math.log2(teams.length))
  const rounds = Math.log2(bracketSize)
  const slots = [...teams, ...Array(bracketSize - teams.length).fill(null)]
  const batch = writeBatch(db)
  const byeAdvances = new Map<string, Partial<TournamentMatch>>()
  for (let round = 1; round <= rounds; round += 1) {
    const matchCount = bracketSize / 2 ** round
    for (let position = 1; position <= matchCount; position += 1) {
      const id = `r${round}-m${position}`
      const nextMatchId = round < rounds ? `r${round + 1}-m${Math.ceil(position / 2)}` : null
      const nextSlot = round < rounds ? (position % 2 ? 'teamAId' : 'teamBId') : null
      batch.set(doc(matchesRef(tournamentId), id), {
        round, position,
        teamAId: round === 1 ? slots[(position - 1) * 2]?.id || null : null,
        teamBId: round === 1 ? slots[(position - 1) * 2 + 1]?.id || null : null,
        teamAName: round === 1 ? slots[(position - 1) * 2]?.name || null : null,
        teamBName: round === 1 ? slots[(position - 1) * 2 + 1]?.name || null : null,
        teamAColor: round === 1 ? slots[(position - 1) * 2]?.color || null : null,
        teamBColor: round === 1 ? slots[(position - 1) * 2 + 1]?.color || null : null,
        scoreA: null, scoreB: null, winnerId: null, nextMatchId, nextSlot,
        loserNextMatchId: null, loserNextSlot: null,
        ...(byeAdvances.get(id) || {}),
        updatedAt: serverTimestamp(),
      })
      if (round === 1) {
        const a = slots[(position - 1) * 2]
        const b = slots[(position - 1) * 2 + 1]
        const bye = a && !b ? a : b && !a ? b : null
        if (bye && nextMatchId && nextSlot) byeAdvances.set(nextMatchId, { [nextSlot]: bye.id })
      }
    }
  }
  await batch.commit()
}

export async function generateDoubleEliminationBracket(tournamentId: string, teams: StoredTeam[]) {
  if (teams.length < 2) throw new Error('Double elimination requires at least two teams.')
  const batch = writeBatch(db)
  const write = (id: string, data: Partial<TournamentMatch>) => batch.set(doc(matchesRef(tournamentId), id), { scoreA: null, scoreB: null, winnerId: null, nextMatchId: null, nextSlot: null, loserNextMatchId: null, loserNextSlot: null, updatedAt: serverTimestamp(), ...data })
  if (teams.length === 2) {
    write('w-r1-m1', { round: 1, position: 1, teamAId: teams[0].id, teamBId: teams[1].id, teamAName: teams[0].name, teamBName: teams[1].name, teamAColor: teams[0].color, teamBColor: teams[1].color, nextMatchId: 'g-m1', nextSlot: 'teamAId', loserNextMatchId: 'g-m1', loserNextSlot: 'teamBId' })
    write('g-m1', { round: 2, position: 1, teamAId: null, teamBId: null })
    await batch.commit()
    return
  }
  const duel = new Duel(teams.length, { last: Duel.LB })
  const winnersRounds = Math.ceil(Math.log2(teams.length))
  const matchId = (id: { s: number; r: number; m: number }) => `${id.s === Duel.WB ? 'w' : 'l'}-r${id.r}-m${id.m}`
  const slot = (index: number | undefined) => index === 0 ? 'teamAId' : index === 1 ? 'teamBId' : null
  for (const match of duel.matches as Array<{ id: { s: number; r: number; m: number }; p: number[] }>) {
    const right = duel.right(match.id) as [{ s: number; r: number; m: number }, number] | null
    const down = duel.down(match.id) as [{ s: number; r: number; m: number }, number] | null
    write(matchId(match.id), {
      round: match.id.s === Duel.WB ? match.id.r : winnersRounds + match.id.r,
      position: match.id.m,
      teamAId: match.p[0] > 0 ? teams[match.p[0] - 1]?.id || null : null,
      teamBId: match.p[1] > 0 ? teams[match.p[1] - 1]?.id || null : null,
      teamAName: match.p[0] > 0 ? teams[match.p[0] - 1]?.name || null : null,
      teamBName: match.p[1] > 0 ? teams[match.p[1] - 1]?.name || null : null,
      teamAColor: match.p[0] > 0 ? teams[match.p[0] - 1]?.color || null : null,
      teamBColor: match.p[1] > 0 ? teams[match.p[1] - 1]?.color || null : null,
      nextMatchId: right ? matchId(right[0]) : null,
      nextSlot: right ? slot(right[1]) : null,
      loserNextMatchId: down ? matchId(down[0]) : null,
      loserNextSlot: down ? slot(down[1]) : null,
      requiresResetOnLowerWinner: Boolean(right && down && matchId(right[0]) === matchId(down[0])),
    })
  }
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
        teamAName: rotation[position].name,
        teamBName: rotation[rotation.length - 1 - position].name,
        teamAColor: rotation[position].color,
        teamBColor: rotation[rotation.length - 1 - position].color,
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
    const winnerIsA = winnerId === match.teamAId
    const winner = {
      id: winnerId,
      name: winnerIsA ? match.teamAName || null : match.teamBName || null,
      color: winnerIsA ? match.teamAColor || null : match.teamBColor || null,
    }
    const loser = {
      id: winnerIsA ? match.teamBId : match.teamAId,
      name: winnerIsA ? match.teamBName || null : match.teamAName || null,
      color: winnerIsA ? match.teamBColor || null : match.teamAColor || null,
    }
    const assignment = (slot: 'teamAId' | 'teamBId', entrant: { id: string; name: string | null; color: string | null }) => ({
      [slot]: entrant.id,
      [slot === 'teamAId' ? 'teamAName' : 'teamBName']: entrant.name,
      [slot === 'teamAId' ? 'teamAColor' : 'teamBColor']: entrant.color,
      updatedAt: serverTimestamp(),
    })
    transaction.update(matchRef, { scoreA, scoreB, winnerId, updatedAt: serverTimestamp() })
    if (match.requiresResetOnLowerWinner && match.nextMatchId && match.nextSlot && match.loserNextMatchId && match.loserNextSlot) {
      // The upper-bracket finalist is in team A. A reset is only needed if the
      // lower-bracket finalist wins this first championship match.
      if (winnerId !== match.teamAId) {
        transaction.update(doc(matchesRef(tournamentId), match.nextMatchId), { ...assignment(match.nextSlot, winner), ...assignment(match.loserNextSlot, loser) })
      }
    } else {
      if (match.nextMatchId && match.nextSlot) transaction.update(doc(matchesRef(tournamentId), match.nextMatchId), assignment(match.nextSlot, winner))
      if (match.loserNextMatchId && match.loserNextSlot) transaction.update(doc(matchesRef(tournamentId), match.loserNextMatchId), assignment(match.loserNextSlot, loser))
    }
  })
}
