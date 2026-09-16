import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { seedTournamentPlayers, subscribeToMatches, subscribeToPlayers, subscribeToTeams, subscribeToTournaments, updateTournament, type StoredTeam, type StoredTournament, type TournamentMatch, type TournamentPlayer } from '@brackify/firebase'
import { auth } from './firebase/client'

type TournamentData = {
  tournaments: StoredTournament[]
  tournament: StoredTournament | null
  teams: StoredTeam[]
  players: TournamentPlayer[]
  matches: TournamentMatch[]
  loading: boolean
  selectTournament: (tournamentId: string) => void
  replaceTeams: (teams: StoredTeam[]) => void
  replaceMatches: (matches: TournamentMatch[]) => void
}

const TournamentContext = createContext<TournamentData>({ tournaments: [], tournament: null, teams: [], players: [], matches: [], loading: true, selectTournament: () => undefined, replaceTeams: () => undefined, replaceMatches: () => undefined })

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [tournaments, setTournaments] = useState<StoredTournament[]>([])
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null)
  const [teams, setTeams] = useState<StoredTeam[]>([])
  const [players, setPlayers] = useState<TournamentPlayer[]>([])
  const [matches, setMatches] = useState<TournamentMatch[]>([])
  const [loading, setLoading] = useState(true)
  // Never fall back to another tournament while a specific selection is loading.
  // That prevents a previous tournament's roster, teams, or matches appearing in a new one.
  const tournament = selectedTournamentId ? tournaments.find(item => item.id === selectedTournamentId) || null : tournaments[0] || null

  useEffect(() => {
    const user = auth.currentUser
    if (!user) return
    return subscribeToTournaments(user.uid, values => { setTournaments(values); setLoading(false) }, () => setLoading(false))
  }, [])
  useEffect(() => {
    if (tournaments.length && !tournaments.some(item => item.id === selectedTournamentId)) setSelectedTournamentId(tournaments[0].id)
  }, [tournaments, selectedTournamentId])

  useEffect(() => {
    if (!tournament) { setTeams([]); setPlayers([]); setMatches([]); return }
    // Clear the old workspace immediately while Firestore subscribes to this tournament.
    setTeams([]); setPlayers([]); setMatches([])
    const unsubscribeTeams = subscribeToTeams(tournament.id, setTeams)
    const unsubscribePlayers = subscribeToPlayers(tournament.id, setPlayers)
    const unsubscribeMatches = subscribeToMatches(tournament.id, setMatches)
    return () => { unsubscribeTeams(); unsubscribePlayers(); unsubscribeMatches() }
  }, [tournament?.id])

  // Repair tournaments created before the roster records were written successfully.
  useEffect(() => {
    if (!tournament || tournament.rosterInitialized || auth.currentUser?.uid !== tournament.organizerId) return
    if (players.length) { void updateTournament(tournament.id, { rosterInitialized: true }); return }
    if (!tournament.playerNames?.length) { void updateTournament(tournament.id, { rosterInitialized: true }); return }
    void seedTournamentPlayers(tournament.id, tournament.playerNames).then(() => updateTournament(tournament.id, { rosterInitialized: true }))
  }, [tournament?.id, tournament?.organizerId, tournament?.playerNames?.join('|'), tournament?.rosterInitialized, players.length])

  const value = useMemo(() => ({ tournaments, tournament, teams, players, matches, loading, selectTournament: setSelectedTournamentId, replaceTeams: setTeams, replaceMatches: setMatches }), [tournaments, tournament, teams, players, matches, loading])
  return <TournamentContext.Provider value={value}>{children}</TournamentContext.Provider>
}

export function useTournamentData() { return useContext(TournamentContext) }
