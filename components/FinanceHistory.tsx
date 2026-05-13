'use client'

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import HistoryPanel from './HistoryPanel'
import { DISASTER_AREAS, HOUSE_NAMES, SHEET_ID, TOTAL_WAVES, getWaveSheetQuery } from '@/lib/constants'
import { getGameState, subscribeStore } from '@/lib/store'
import { X } from 'lucide-react'

type HistoryType = 'income' | 'bet' | 'reward' | 'lose' | 'start' | 'disaster'

interface HistoryEntry {
  wave?: number
  label: string
  detail?: string
  amount: number
  type: HistoryType
  timestamp?: string
  betTarget?: number
}

interface OrderedHistoryEntry extends HistoryEntry {
  order: number
}

interface MiniGameRank {
  rank: number | null
  baan: number | null
  reward: number | null
}

type RankingModalKind = 'bet-return' | 'ladder'

interface FinanceHistoryProps {
  initialBaan?: number | null
  initialWave?: number | 'all'
  lockBaan?: boolean
  showFilters?: boolean
  showResults?: boolean
  enableBetReturnRanking?: boolean
  className?: string
}

const parseGViz = (text: string): any[] => {
  const js = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/)?.[1]
  return js ? JSON.parse(js)?.table?.rows ?? [] : []
}

const fetchSheetRows = async (query: string) => {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&${query}`
  const text = await (await fetch(url, { cache: 'no-store' })).text()
  return parseGViz(text)
}

const fetchMiniGameRanking = async (wave: number): Promise<MiniGameRank[]> => {
  const query = `${getWaveSheetQuery(wave)}&range=${encodeURIComponent('B20:D31')}`
  const rows = await fetchSheetRows(query)
  return Array.from({ length: 12 }, (_, i) => {
    const baanRaw = rows?.[i]?.c?.[0]?.v
    const rewardRaw = rows?.[i]?.c?.[2]?.v
    const baan = parseInt(String(baanRaw ?? ''))
    const reward = parseFloat(String(rewardRaw ?? ''))
    return {
      rank: i + 1,
      baan: !isNaN(baan) && baan >= 1 && baan <= 12 ? baan : null,
      reward: Number.isFinite(reward) ? reward : null,
    }
  })
}

const fetchLadderRanking = async (wave: number): Promise<MiniGameRank[]> => {
  const query = `${getWaveSheetQuery(wave)}&range=${encodeURIComponent('Y20:Y31')}`
  const rows = await fetchSheetRows(query)
  return Array.from({ length: 12 }, (_, i) => {
    const rankRaw = rows?.[i]?.c?.[0]?.v
    const rank = parseInt(String(rankRaw ?? ''))
    return {
      rank: Number.isFinite(rank) ? rank : null,
      baan: i + 1,
      reward: null,
    }
  }).sort((a, b) => {
    const rankA = a.rank ?? Number.POSITIVE_INFINITY
    const rankB = b.rank ?? Number.POSITIVE_INFINITY
    return rankA - rankB || (a.baan ?? 99) - (b.baan ?? 99)
  })
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

const formatPercent = (returnAmount: number, spent: number) => {
  if (!spent || !returnAmount) return '0%'
  const pct = (returnAmount / spent) * 100
  return `${Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(1)}%`
}

function FinanceHistory({
  initialBaan = null,
  initialWave = 'all',
  lockBaan = false,
  showFilters = true,
  showResults: showResultsOverride,
  enableBetReturnRanking = false,
  className,
}: FinanceHistoryProps) {
  const [selectedBaan, setSelectedBaan] = useState<number | null>(initialBaan)
  const [selectedWave, setSelectedWave] = useState<number | 'all'>(initialWave)
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [balance, setBalance] = useState<number | undefined>(undefined)
  const [lastRefresh, setLastRefresh] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentWave, setCurrentWave] = useState(getGameState().currentWave)
  const [stateShowResults, setStateShowResults] = useState(getGameState().showResults === true)
  const [rankingKind, setRankingKind] = useState<RankingModalKind>('bet-return')
  const [rankingWave, setRankingWave] = useState<number | null>(null)
  const [rankingBetTarget, setRankingBetTarget] = useState<number | null>(null)
  const [miniGameRanking, setMiniGameRanking] = useState<MiniGameRank[]>([])
  const [rankingLoading, setRankingLoading] = useState(false)
  const [rankingError, setRankingError] = useState('')
  const showResults = showResultsOverride ?? stateShowResults

  useEffect(() => setSelectedBaan(initialBaan), [initialBaan])
  useEffect(() => setSelectedWave(initialWave), [initialWave])
  useEffect(() => {
    const update = () => {
      const state = getGameState()
      setCurrentWave(state.currentWave)
      setStateShowResults(state.showResults === true)
    }
    const unsub = subscribeStore(update)
    return unsub
  }, [])
  useEffect(() => {
    if (selectedWave !== 'all' && selectedWave > currentWave) setSelectedWave(currentWave)
  }, [currentWave, selectedWave])

  const wavesToRead = useMemo(
    () => selectedWave === 'all'
      ? Array.from({ length: currentWave }, (_, i) => i + 1)
      : [Math.min(selectedWave, currentWave)],
    [currentWave, selectedWave],
  )

  const refresh = useCallback(async () => {
    if (!selectedBaan) {
      setEntries([])
      setBalance(undefined)
      return
    }

    setLoading(true)
    try {
      const nextEntries: OrderedHistoryEntry[] = []
      let latestBalance: number | undefined
      let morningAdded = false

      for (const wave of wavesToRead) {
        const rows = await fetchSheetRows(getWaveSheetQuery(wave))
        const row = rows.find((r: any) => parseInt(String(r?.c?.[0]?.v ?? '')) === selectedBaan)
        if (!row) continue

        const c = row.c ?? []
        const read = (idx: number) => c?.[idx]?.v
        const numberAt = (idx: number) => parseFloat(String(read(idx) ?? 0)) || 0
        const textAt = (idx: number) => String(read(idx) ?? '').trim()
        const startingBalance = numberAt(1)
        const isCurrentWave = wave === currentWave
        const revealWave = showResults || !isCurrentWave

        if (!morningAdded && wave === 1) {
          latestBalance = startingBalance
          nextEntries.push({
            order: 0,
            label: 'Morning score',
            detail: 'Wave 1 starting money from B5:B16',
            amount: startingBalance,
            type: startingBalance >= 0 ? 'income' : 'lose',
          })
          morningAdded = true
        }

        const waveKing = parseInt(String(rows?.[19]?.c?.[7]?.v ?? ''))
        const kingHouse = isNaN(waveKing) ? null : waveKing
        const waveDisasterRaw = parseInt(String(rows?.[21]?.c?.[7]?.v ?? ''))
        const waveDisaster = isNaN(waveDisasterRaw) ? null : waveDisasterRaw
        const affectedAreas = affectedAreasFor(waveDisaster)
        const winnerRow = rows.find((r: any) => String(r?.c?.[6]?.v ?? '').trim() === '1')
        const winningKingHouse = winnerRow ? parseInt(String(winnerRow?.c?.[0]?.v ?? '')) : null
        const winningKingBid = winnerRow ? parseFloat(String(winnerRow?.c?.[5]?.v ?? 0)) || 0 : 0

        const betHouse = textAt(2)
        const betAmountSheet = numberAt(3)
        const betReturn = numberAt(4)
        if (betHouse || betAmountSheet) {
          nextEntries.push({
            order: wave * 100 + 10,
            wave,
            label: 'Bet',
            detail: `House ${betHouse || '-'} · spent ${betAmountSheet.toLocaleString()}`,
            amount: -betAmountSheet,
            type: 'bet',
          })
        }

        const kingAmount = numberAt(5)
        const kingResult = textAt(6)
        if (kingAmount) {
          nextEntries.push({
            order: wave * 100 + 20,
            wave,
            label: 'King bid',
            detail: `King bid ${kingAmount.toLocaleString()}`,
            amount: -kingAmount,
            type: 'bet',
          })
        }

        const islandBidLines: string[] = []
        const islandReturnLines: string[] = []
        let islandSpentTotal = 0
        let islandReturnTotal = 0
        ;[[7, 8, 9], [10, 11, 12], [13, 14, 15]].forEach(([nameIdx, amountIdx, returnIdx]) => {
          const area = textAt(nameIdx)
          const spent = numberAt(amountIdx)
          const got = numberAt(returnIdx)
          if (area || spent) {
            islandBidLines.push(`${area || '-'}: ${spent.toLocaleString()}`)
            islandSpentTotal += spent
          }
          if (area || spent || got) {
            const status = got <= 0
              ? 'lose'
              : affectedAreas.has(area)
                ? 'win, but disaster-ed'
                : `win, ${formatPercent(got, spent)}`
            islandReturnLines.push(`${area || '-'}: ${got.toLocaleString()} (${status})`)
            islandReturnTotal += got
          }
        })
        if (islandBidLines.length) {
          nextEntries.push({
            order: wave * 100 + 30,
            wave,
            label: 'Island bid',
            detail: islandBidLines.join('\n'),
            amount: -islandSpentTotal,
            type: 'bet',
          })
        }

        if (revealWave) {
          latestBalance = read(20) != null && String(read(20)).trim() !== ''
            ? numberAt(20)
            : startingBalance - betAmountSheet - kingAmount - islandSpentTotal + betReturn + islandReturnTotal
        } else {
          latestBalance = startingBalance - betAmountSheet - kingAmount - islandSpentTotal
        }

        const extras = [
          { label: 'MiniGame', amount: numberAt(17) },
          { label: 'MoneyDrop', amount: numberAt(18) },
          { label: 'Event', amount: numberAt(19) },
        ].filter(x => x.amount)
        if (revealWave) extras.forEach((x, idx) => nextEntries.push({
          order: wave * 100 + 40 + idx,
          wave,
          label: x.label,
          detail: 'Gain from other game',
          amount: x.amount,
          type: x.amount >= 0 ? 'income' : 'lose',
        }))

        if (revealWave && (wave === 2 || wave === 4)) {
          const ladderAmount = numberAt(24)
          nextEntries.push({
            order: wave * 100 + 45,
            wave,
            label: 'เกมพลิกเกม - บันไดงูพิสดาร',
            detail: 'เงินที่ได้จากการเก็บซองคำใบ้',
            amount: ladderAmount,
            type: 'income',
          })
        }

        if (revealWave && (betHouse || betAmountSheet || betReturn)) {
          const parsedBetTarget = parseInt(betHouse)
          nextEntries.push({
            order: wave * 100 + 60,
            wave,
            label: betReturn > 0 ? 'Bet return: win' : 'Bet return: lose',
            detail: `Return ${betReturn.toLocaleString()}`,
            amount: betReturn,
            type: betReturn > 0 ? 'reward' : 'lose',
            betTarget: !isNaN(parsedBetTarget) ? parsedBetTarget : undefined,
          })
        }
        if (revealWave && islandReturnLines.length) {
          nextEntries.push({
            order: wave * 100 + 70,
            wave,
            label: islandReturnTotal > 0 ? 'Island return' : 'Island return: lose',
            detail: islandReturnLines.join('\n'),
            amount: islandReturnTotal,
            type: islandReturnTotal > 0 ? 'income' : 'lose',
          })
        }
        if (revealWave && (kingAmount || kingResult || winningKingHouse)) {
          nextEntries.push({
            order: wave * 100 + 80,
            wave,
            label: 'King result',
            detail: kingResult === '1'
              ? `Will be next king · winning bid ${winningKingBid.toLocaleString()}`
              : `Not king${winningKingHouse ? ` · House ${winningKingHouse} won with ${winningKingBid.toLocaleString()}` : ''}${kingHouse ? ` · current king House ${kingHouse}` : ''}`,
            amount: 0,
            type: kingResult === '1' ? 'reward' : 'lose',
          })
        }
        if (revealWave && wave === 5) {
          const kingFinalBonus = numberAt(21)
          const islandFinalBonus = numberAt(22)
          if (kingFinalBonus) {
            nextEntries.push({
              order: wave * 100 + 100,
              wave,
              label: 'Final king bonus',
              detail: 'Wave 5 V column · last king',
              amount: kingFinalBonus,
              type: 'reward',
            })
          }
          if (islandFinalBonus) {
            nextEntries.push({
              order: wave * 100 + 110,
              wave,
              label: 'Final island ownership bonus',
              detail: 'Wave 5 W column · score from owned islands',
              amount: islandFinalBonus,
              type: 'reward',
            })
          }
        }
      }

      setBalance(latestBalance)
      setEntries(nextEntries.sort((a, b) => a.order - b.order))
      setLastRefresh(new Date().toLocaleTimeString('th-TH'))
    } catch (e) {
      console.error(e)
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [selectedBaan, wavesToRead, showResults, currentWave])

  useEffect(() => {
    refresh()
    const t = window.setInterval(refresh, 45000)
    return () => window.clearInterval(t)
  }, [refresh])

  const openMiniGameRanking = useCallback(async (wave: number, betTarget?: number) => {
    setRankingKind('bet-return')
    setRankingWave(wave)
    setRankingBetTarget(betTarget ?? null)
    setMiniGameRanking([])
    setRankingError('')
    setRankingLoading(true)
    try {
      setMiniGameRanking(await fetchMiniGameRanking(wave))
    } catch (e) {
      console.error(e)
      setRankingError('ไม่สามารถโหลดอันดับการเล่นเกมเดี่ยวได้')
    } finally {
      setRankingLoading(false)
    }
  }, [])
  const openLadderRanking = useCallback(async (wave: number) => {
    setRankingKind('ladder')
    setRankingWave(wave)
    setRankingBetTarget(null)
    setMiniGameRanking([])
    setRankingError('')
    setRankingLoading(true)
    try {
      setMiniGameRanking(await fetchLadderRanking(wave))
    } catch (e) {
      console.error(e)
      setRankingError('ไม่สามารถโหลดอันดับเงินจากเกมบันไดงูได้')
    } finally {
      setRankingLoading(false)
    }
  }, [])
  const rankingColumns = [
    miniGameRanking.slice(0, 6),
    miniGameRanking.slice(6, 12),
  ]
  const showRankingRewards = rankingKind === 'bet-return'
  const rankingTitle = rankingKind === 'ladder'
    ? 'ประกาศอันดับเงินจากการเล่น "เกมพลิกเกม - บันไดงูพิสดาร"'
    : 'ประกาศผลการเล่นเกมเดี่ยว (นำมาพิจารณาผลการแทงม้า)'

  return (
    <div className={clsx('finance-history space-y-3', className)}>
      {!showResults && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Current wave results are hidden. Previous waves are shown; current balance uses this wave starting money minus submitted spending.
        </div>
      )}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {!lockBaan && (
            <select value={selectedBaan ?? ''} onChange={e => setSelectedBaan(e.target.value ? parseInt(e.target.value) : null)}
              className="input-base w-auto min-w-40">
              <option value="">เลือกบ้าน</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(b => (
                <option key={b} value={b}>{HOUSE_NAMES[b]}</option>
              ))}
            </select>
          )}
          <button onClick={() => setSelectedWave('all')} className={clsx('btn', selectedWave === 'all' ? 'btn-primary' : 'btn-ghost')}>
            All
          </button>
          {Array.from({ length: Math.min(TOTAL_WAVES, currentWave) }, (_, i) => i + 1).map(w => (
            <button key={w} onClick={() => setSelectedWave(w)}
              className={clsx('btn', selectedWave === w ? 'btn-primary' : 'btn-ghost')}>
              W{w}
            </button>
          ))}
          <button onClick={refresh} disabled={loading} className="btn btn-ghost ml-auto">
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          {lastRefresh && <span className="text-xs text-slate-500">updated {lastRefresh}</span>}
        </div>
      )}

      {selectedBaan ? (
        <HistoryPanel
          entries={entries}
          baan={selectedBaan}
          balance={balance}
          title="ประวัติการเงิน"
          maxHeight="none"
          onBetReturnRankingClick={enableBetReturnRanking ? openMiniGameRanking : undefined}
          onLadderRankingClick={enableBetReturnRanking ? openLadderRanking : undefined}
        />
      ) : (
        <div className="wire-panel bg-white p-8 text-center text-slate-600">
          เลือกบ้านเพื่อดูประวัติการเงิน
        </div>
      )}

      {rankingWave !== null && (
        <div className="mini-game-modal-backdrop">
          <div className="mini-game-modal-panel">
            <div className={clsx('mini-game-modal-header', rankingKind === 'ladder' && 'is-ladder')}>
              <div>
                <h2 className="mini-game-modal-title">
                  {rankingTitle}
                </h2>
                <p className="mini-game-modal-subtitle">รอบที่ {rankingWave}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRankingWave(null)
                  setRankingBetTarget(null)
                }}
                className="mini-game-modal-close"
                aria-label="Close ranking popup"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mini-game-modal-body">
              {rankingLoading ? (
                <div className="mini-game-ranking-state">
                  กำลังโหลดอันดับ...
                </div>
              ) : rankingError ? (
                <div className="mini-game-ranking-error">
                  {rankingError}
                </div>
              ) : (
                <div className="mini-game-ranking-columns">
                  {rankingColumns.map((column, columnIndex) => (
                    <div key={columnIndex} className="mini-game-ranking-column">
                      {column.map(row => (
                        <div
                          key={`${row.baan ?? 'unknown'}-${row.rank ?? 'blank'}`}
                          className={clsx(
                            'mini-game-ranking-row',
                            !showRankingRewards && 'is-no-reward',
                            row.rank !== null && row.rank <= 3 && 'is-top-rank',
                            row.rank === 1 && 'is-rank-1',
                            row.rank === 2 && 'is-rank-2',
                            row.rank === 3 && 'is-rank-3',
                            showRankingRewards && row.baan === rankingBetTarget && 'is-player-bet'
                          )}
                        >
                          <div className="mini-game-ranking-number">{row.rank ?? '-'}</div>
                          <div className="mini-game-ranking-copy">
                            <div className="mini-game-ranking-label">อันดับที่ {row.rank ?? '-'}</div>
                            <div className="mini-game-ranking-house">
                              {row.baan ? HOUSE_NAMES[row.baan] : '-'}
                            </div>
                            {showRankingRewards && row.baan === rankingBetTarget && (
                              <div className="mini-game-ranking-player-note">บ้านที่คุณแทง</div>
                            )}
                          </div>
                          {showRankingRewards && (
                            <div className="mini-game-ranking-reward">
                              <div className="mini-game-ranking-reward-label">ผลตอบแทน</div>
                              <div
                                className={clsx(
                                  'mini-game-ranking-reward-value',
                                  row.reward !== null && row.reward >= 100 && 'is-reward-good',
                                  row.reward !== null && row.reward < 99 && 'is-reward-bad'
                                )}
                              >
                                {row.reward !== null ? `${row.reward.toLocaleString()}%` : '-'}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(FinanceHistory)
