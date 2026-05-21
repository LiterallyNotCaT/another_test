export function withCompetitionRanks<T>(
  items: T[],
  getScore: (item: T) => number,
): Array<T & { rank: number }> {
  let previousScore: number | null = null
  let previousRank = 0

  return items.map((item, index) => {
    const score = getScore(item)
    const rank = previousScore !== null && score === previousScore
      ? previousRank
      : index + 1

    previousScore = score
    previousRank = rank

    return { ...item, rank }
  })
}
