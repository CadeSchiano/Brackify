export type TournamentFormat = 'single_elimination' | 'double_elimination' | 'round_robin'
export type TournamentRole = 'organizer' | 'admin' | 'player' | 'spectator'

export interface Player {
  id: string
  displayName: string
  checkedIn: boolean
}

export interface Team {
  id: string
  name: string
  color: string
  playerIds: string[]
}

export interface Tournament {
  id: string
  name: string
  description: string
  format: TournamentFormat
  organizerId: string
  playerCount: number
  teamCount: number
  createdAt: string
}
