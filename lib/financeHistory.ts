import { DISASTER_AREAS } from './constants'
import type { WaveInputRow } from './sheets'

export interface FinanceHistoryEntry {
  wave?: number
  label: string
  detail?: string
  amount: number
  type: 'income' | 'bet' | 'reward' | 'lose' | 'start' | 'disaster'
  timestamp?: string
}

export interface FinanceWaveData {
  wave: number
  rows: WaveInputRow[]
  kingDisaster: number | null
  kingHouse?: number | null
}

interface BuildFinanceHistoryOptions {
  baan: number
  waves: FinanceWaveData[]
  morningScore?: number
}

const affectedAreasFor = (disaster: number | null) => {
  const rule = disaster ? DISASTER_AREAS[disaster] : null
  const affected = new Set<string>()
  if (!rule) return affected
  ;(['A', 'B', 'C'] as const).forEach(group => {
    rule[group].forEach(n => affected.add(`${group}${n}`))
  })
  return affected
}

export function buildFinanceHistory({
  baan,
  waves,
  morningScore,
}: BuildFinanceHistoryOptions): FinanceHistoryEntry[] {
  const entries: FinanceHistoryEntry[] = []
  if (morningScore != null) {
    entries.push({
      label: 'Morning score',
      detail: 'เงินต้นก่อน Bet',
      amount: morningScore,
      type: morningScore >= 0 ? 'income' : 'lose',
    })
  }

  for (const waveData of waves) {
    const row = waveData.rows.find(r => r.baan === baan)
    if (!row) continue
    const affected = affectedAreasFor(waveData.kingDisaster)

    if (row.betTarget || row.betAmount) {
      entries.push({
        wave: waveData.wave,
        label: 'Bet',
        detail: `guess house ${row.betTarget || '-'}`,
        amount: -row.betAmount,
        type: 'bet',
      })
    }
    if (row.betReturn) {
      entries.push({
        wave: waveData.wave,
        label: row.betReturn >= row.betAmount ? 'Bet return: win' : 'Bet return: lose',
        detail: `got back ${row.betReturn.toLocaleString()}`,
        amount: row.betReturn,
        type: row.betReturn >= row.betAmount ? 'reward' : 'lose',
      })
    }

    if (row.kingAmount) {
      entries.push({
        wave: waveData.wave,
        label: 'King bid',
        detail: `King island bid ${row.kingAmount.toLocaleString()}`,
        amount: -row.kingAmount,
        type: 'bet',
      })
    }
    if (row.kingResult) {
      entries.push({
        wave: waveData.wave,
        label: 'King result',
        detail: row.kingResult === '1' ? 'will be king next wave' : 'not king next wave',
        amount: 0,
        type: row.kingResult === '1' ? 'reward' : 'lose',
      })
    }

    const islandBidLines: string[] = []
    const islandReturnLines: string[] = []
    let islandSpentTotal = 0
    let islandReturnTotal = 0
    for (const island of row.islands) {
      if (island.name || island.amount) {
        islandBidLines.push(`${island.name || '-'}: ${island.amount.toLocaleString()}`)
        islandSpentTotal += island.amount
      }
      if (!island.name && !island.amount && !island.returnAmount) continue
      const returned = island.returnAmount
      const wonBid = returned > 0
      const disastered = wonBid && affected.has(island.name)
      const status = !wonBid ? 'lose' : disastered ? 'disaster-ed' : 'win'
      islandReturnLines.push(`${island.name || '-'}: ${returned.toLocaleString()} (${status})`)
      islandReturnTotal += returned
    }
    if (islandBidLines.length) {
      entries.push({
        wave: waveData.wave,
        label: 'Island bid',
        detail: islandBidLines.join('\n'),
        amount: -islandSpentTotal,
        type: 'bet',
      })
    }
    if (islandReturnLines.length) {
      entries.push({
        wave: waveData.wave,
        label: islandReturnTotal > 0 ? 'Island return' : 'Island return: lose',
        detail: islandReturnLines.join('\n'),
        amount: islandReturnTotal,
        type: islandReturnTotal > 0 ? 'income' : 'lose',
      })
    }

    row.adjustments.filter(x => x.amount).forEach(adj => {
      entries.push({
        wave: waveData.wave,
        label: adj.label || 'Other game',
        detail: 'income from other game',
        amount: adj.amount,
        type: adj.amount >= 0 ? 'income' : 'lose',
      })
    })
  }

  return entries
}
