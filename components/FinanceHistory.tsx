'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import HistoryPanel from './HistoryPanel'
import { DISASTER_AREAS, HOUSE_NAMES, SHEET_ID, TOTAL_WAVES, getWaveSheetQuery } from '@/lib/constants'
import { getGameState, subscribeStore } from '@/lib/store'

type HistoryType = 'income' | 'bet' | 'reward' | 'lose' | 'start' | 'disaster'

interface HistoryEntry {
  wave?: number
  label: string
  detail?: string
  amount: number
  type: HistoryType
  timestamp?: string
}

interface OrderedHistoryEntry extends HistoryEntry {
  order: number
}

interface FinanceHistoryProps {
  initialBaan?: number | null
  initialWave?: number | 'all'
  lockBaan?: boolean
  showFilters?: boolean
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

export default function FinanceHistory({
  initialBaan = null,
  initialWave = 'all',
  lockBaan = false,
  showFilters = true,
  className,
}: FinanceHistoryProps) {
  const [selectedBaan, setSelectedBaan] = useState<number | null>(initialBaan)
  const [selectedWave, setSelectedWave] = useState<number | 'all'>(initialWave)
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [balance, setBalance] = useState<number | undefined>(undefined)
  const [lastRefresh, setLastRefresh] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentWave, setCurrentWave] = useState(getGameState().currentWave)

  useEffect(() => setSelectedBaan(initialBaan), [initialBaan])
  useEffect(() => setSelectedWave(initialWave), [initialWave])
  useEffect(() => {
    const update = () => setCurrentWave(getGameState().currentWave)
    const unsub = subscribeStore(update)
    const poll = window.setInterval(update, 3000)
    return () => { unsub(); window.clearInterval(poll) }
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
      for (const wave of wavesToRead) {
        const rows = await fetchSheetRows(getWaveSheetQuery(wave))
        const row = rows.find((r: any) => parseInt(String(r?.c?.[0]?.v ?? '')) === selectedBaan)
        if (!row) continue
        const waveKing = parseInt(String(rows?.[19]?.c?.[7]?.v ?? ''))
        const kingHouse = isNaN(waveKing) ? null : waveKing
        const waveDisasterRaw = parseInt(String(rows?.[21]?.c?.[7]?.v ?? ''))
        const waveDisaster = isNaN(waveDisasterRaw) ? null : waveDisasterRaw
        const affectedAreas = affectedAreasFor(waveDisaster)
        const winnerRow = rows.find((r: any) => String(r?.c?.[6]?.v ?? '').trim() === '1')
        const winningKingHouse = winnerRow ? parseInt(String(winnerRow?.c?.[0]?.v ?? '')) : null
        const winningKingBid = winnerRow ? parseFloat(String(winnerRow?.c?.[5]?.v ?? 0)) || 0 : 0
        const c = row.c ?? []
        const read = (idx: number) => c?.[idx]?.v
        const numberAt = (idx: number) => parseFloat(String(read(idx) ?? 0)) || 0
        const textAt = (idx: number) => String(read(idx) ?? '').trim()
        latestBalance = read(20) != null && String(read(20)).trim() !== ''
          ? numberAt(20)
          : latestBalance
        if (wave === 1) {
          const morningScore = numberAt(1)
          if (morningScore) {
            nextEntries.push({
              order: 0,
              label: 'Morning score',
              detail: 'เงินตั้งต้นก่อน Bet Wave 1',
              amount: morningScore,
              type: morningScore >= 0 ? 'income' : 'lose',
            })
          }
        }

        const betHouse = textAt(2)
        const betAmountSheet = numberAt(3)
        const betReturn = numberAt(4)
        if (betHouse || betAmountSheet) {
          nextEntries.push({
            order: wave * 100 + 10,
            wave,
            label: 'Bet',
            detail: `บ้าน ${betHouse || '-'} · ลง ${betAmountSheet.toLocaleString()}`,
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
            detail: `ลงประมูล King ${kingAmount.toLocaleString()}`,
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
            const status = got <= 0 ? 'lose' : affectedAreas.has(area) ? 'disaster-ed' : 'win'
            const pct = formatPercent(got, spent)
            islandReturnLines.push(`${area || '-'}: ${got.toLocaleString()} (${status === 'disaster-ed' ? 'win, disaster-ed' : got > 0 ? `win, ${pct}` : 'lose'})`)
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

        const extras = [
          { label: 'MiniGame', amount: numberAt(17) },
          { label: 'MoneyDrop', amount: numberAt(18) },
          { label: 'พลิกเกม', amount: numberAt(19) },
        ].filter(x => x.amount)
        extras.forEach((x, idx) => nextEntries.push({
          order: wave * 100 + 40 + idx,
          wave,
          label: x.label,
          detail: 'ได้เงินจาก Game อื่น',
          amount: x.amount,
          type: x.amount >= 0 ? 'income' : 'lose',
        }))

        if (betHouse || betAmountSheet || betReturn) {
          nextEntries.push({
            order: wave * 100 + 60,
            wave,
            label: betReturn > 0 ? 'Bet return: win' : 'Bet return: lose',
            detail: `ได้คืน ${betReturn.toLocaleString()}`,
            amount: betReturn,
            type: betReturn > 0 ? 'reward' : 'lose',
          })
        }
        if (islandReturnLines.length) {
          nextEntries.push({
            order: wave * 100 + 70,
            wave,
            label: islandReturnTotal > 0 ? 'Island return' : 'Island return: lose',
            detail: islandReturnLines.join('\n'),
            amount: islandReturnTotal,
            type: islandReturnTotal > 0 ? 'income' : 'lose',
          })
        }
        if (kingAmount || kingResult || winningKingHouse) {
          nextEntries.push({
            order: wave * 100 + 80,
            wave,
            label: 'King result',
            detail: kingResult === '1'
              ? `จะเป็น King ตาต่อไป · winning bid ${winningKingBid.toLocaleString()}`
              : `ไม่ได้เป็น King${winningKingHouse ? ` · บ้าน ${winningKingHouse} ชนะด้วย ${winningKingBid.toLocaleString()}` : ''}${kingHouse ? ` · King ตานี้ บ้าน ${kingHouse}` : ''}`,
            amount: 0,
            type: kingResult === '1' ? 'reward' : 'lose',
          })
        }
        if (wave === 5) {
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
  }, [selectedBaan, wavesToRead])

  useEffect(() => {
    refresh()
    const t = window.setInterval(refresh, 20000)
    return () => window.clearInterval(t)
  }, [refresh])

  return (
    <div className={clsx('finance-history space-y-3', className)}>
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
        />
      ) : (
        <div className="wire-panel bg-white p-8 text-center text-slate-600">
          เลือกบ้านเพื่อดูประวัติการเงิน
        </div>
      )}
    </div>
  )
}
