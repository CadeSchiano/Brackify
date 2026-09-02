import type { Player, Team } from '@brackify/types'

const teamColors = ['#D6FF3F', '#FF6B71', '#8A7CFF', '#55C8FF', '#FFC267', '#63D9B8', '#FF9A7B', '#81B9FF']

function securelyShuffle<T>(items: T[]) {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const limit = Math.floor(0x100000000 / (index + 1)) * (index + 1)
    const random = new Uint32Array(1)
    do crypto.getRandomValues(random)
    while (random[0] >= limit)
    ;[shuffled[index], shuffled[random[0] % (index + 1)]] = [shuffled[random[0] % (index + 1)], shuffled[index]]
  }
  return shuffled
}

export function generateBalancedTeams(players: Player[], count: number): Team[] {
  if (!Number.isInteger(count) || count < 2 || count > teamColors.length) throw new Error('Choose between 2 and 8 teams.')
  const shuffled = securelyShuffle(players)
  return Array.from({ length: count }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Team ${index + 1}`,
    color: teamColors[index],
    playerIds: shuffled.filter((_, playerIndex) => playerIndex % count === index).map(player => player.id),
  }))
}
