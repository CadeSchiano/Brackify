declare module 'duel' {
  type MatchId = { s: number; r: number; m: number }
  type DuelMatch = { id: MatchId; p: number[] }
  class Duel {
    static WB: number
    static LB: number
    matches: DuelMatch[]
    constructor(players: number, options: { last: number })
    right(id: MatchId): [MatchId, number] | null
    down(id: MatchId): [MatchId, number] | null
  }
  export default Duel
}
