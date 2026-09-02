import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { subscribeToMatches, subscribeToPlayers, subscribeToTeams, subscribeToTournaments, type StoredTeam, type StoredTournament, type TournamentMatch, type TournamentPlayer } from '@brackify/firebase'
import { auth } from './firebase/client'

type TournamentData = {
  tournaments: StoredTournament[]
  tournament: StoredTournament | null
  teams: StoredTeam[]
  players: TournamentPlayer[]
  matches: TournamentMatch[]
  loading: boolean
  selectTournament: (tournamentId: string) => void
}

const TournamentContext = createContext<TournamentData>({ tournaments: [], tournament: null, teams: [], players: [], matches: [], loading: true, selectTournament: () => undefined })

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [tournaments, setTournaments] = useState<StoredTournament[]>([])
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null)
  const [teams, setTeams] = useState<StoredTeam[]>([])
  const [players, setPlayers] = useState<TournamentPlayer[]>([])
  const [matches, setMatches] = useState<TournamentMatch[]>([])
  const [loading, setLoading] = useState(true)
  const tournament = tournaments.find(item => item.id === selectedTournamentId) || tournaments[0] || null

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
    const unsubscribeTeams = subscribeToTeams(tournament.id, setTeams)
    const unsubscribePlayers = subscribeToPlayers(tournament.id, setPlayers)
    const unsubscribeMatches = subscribeToMatches(tournament.id, setMatches)
    return () => { unsubscribeTeams(); unsubscribePlayers(); unsubscribeMatches() }
  }, [tournament?.id])

  const value = useMemo(() => ({ tournaments, tournament, teams, players, matches, loading, selectTournament: setSelectedTournamentId }), [tournaments, tournament, teams, players, matches, loading])
  return <TournamentContext.Provider value={value}>{children}</TournamentContext.Provider>
}

export function useTournamentData() { return useContext(TournamentContext) }
