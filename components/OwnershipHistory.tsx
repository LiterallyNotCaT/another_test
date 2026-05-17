'use client'

import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { HOUSE_COLORS, HOUSE_NAMES, SHEET_ID, TOTAL_WAVES, getWaveSheetQuery } from '@/lib/constants'

export interface OwnershipRow {
  baan: number
  areas: string[]
  disasterAreas: string[]
  count: number
}

const parseGViz = (text: string): any[] => {
  const js = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/)?.[1]
  return js ? JSON.parse(js)?.table?.rows ?? [] : []
}

async function fetchRows(wave: number) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&${getWaveSheetQuery(wave)}`
  const text = await (await fetch(url, { cache: 'no-store' })).text()
  return parseGViz(text)
}

export async function fetchWaveOwnership(wave: number): Promise<{ ownership: Record<string, number>; rows: OwnershipRow[] }> {
  const sheetRows = await fetchRows(wave)
  const ownership: Record<string, number> = {}
  const rows: OwnershipRow[] = []

  sheetRows.slice(19, 31).forEach((row: any) => {
    const baan = parseInt(String(row?.c?.[9]?.v ?? ''))
    if (!baan || baan < 1 || baan > 12) return
    const rawAreas = String(row?.c?.[10]?.v ?? '').trim()
    const rawDisasterAreas = String(row?.c?.[13]?.v ?? '').trim()
    const areas = rawAreas && rawAreas !== '-'
      ? rawAreas.split(',').map(a => a.trim()).filter(Boolean)
      : []
    const disasterAreas = rawDisasterAreas && rawDisasterAreas !== '-'
      ? rawDisasterAreas.split(',').map(a => a.trim()).filter(Boolean)
      : []
    const count = parseFloat(String(row?.c?.[11]?.v ?? areas.length)) || areas.length
    rows.push({ baan, areas, disasterAreas, count })
    areas.forEach(area => { ownership[area] = baan })
  })

  return { ownership, rows: rows.sort((a, b) => a.baan - b.baan) }
}

export function useWaveOwnership(wave: number) {
  const [ownership, setOwnership] = useState<Record<string, number>>({})
  const [rows, setRows] = useState<OwnershipRow[]>([])

  const refresh = useCallback(async () => {
    try {
      const data = await fetchWaveOwnership(wave)
      setOwnership(data.ownership)
      setRows(data.rows)
    } catch (e) {
      console.error(e)
    }
  }, [wave])

  useEffect(() => {
    refresh()
    const t = window.setInterval(refresh, 20000)
    return () => window.clearInterval(t)
  }, [refresh])

  return { ownership, rows, refresh }
}

export default function OwnershipHistory({ visibleThroughWave = TOTAL_WAVES, className }: { wave?: number; visibleThroughWave?: number; className?: string }) {
  const [matrix, setMatrix] = useState<Record<number, Record<number, { areas: string[]; disasterAreas: string[] }>>>({})
  const maxVisibleWave = Math.max(1, Math.min(TOTAL_WAVES, visibleThroughWave))

  const refreshAll = useCallback(async () => {
    try {
      const next: Record<number, Record<number, { areas: string[]; disasterAreas: string[] }>> = {}
      await Promise.all(Array.from({ length: TOTAL_WAVES }, async (_, i) => {
        const wave = i + 1
        if (wave > maxVisibleWave) return
        const data = await fetchWaveOwnership(wave)
        next[wave] = {}
        data.rows.forEach(row => {
          next[wave][row.baan] = { areas: row.areas, disasterAreas: row.disasterAreas }
        })
      }))
      setMatrix(next)
    } catch (e) {
      console.error(e)
    }
  }, [maxVisibleWave])

  useEffect(() => {
    refreshAll()
    const t = window.setInterval(refreshAll, 20000)
    return () => window.clearInterval(t)
  }, [refreshAll])

  return (
    <div className={clsx('ownership-history wire-panel bg-white p-4', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="font-display text-sm font-bold text-slate-800">Ownership history</div>
        <button onClick={refreshAll} className="btn btn-ghost py-1.5 px-2 text-xs">Refresh</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2 text-left">House</th>
              {Array.from({ length: TOTAL_WAVES }, (_, i) => (
                <th key={i + 1} className="px-3 py-2 text-left">Wave {i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(baan => (
              <tr key={baan} className="border-b border-slate-100">
                <td className="whitespace-nowrap px-3 py-2 font-semibold" style={{ color: HOUSE_COLORS[baan] }}>
                  {HOUSE_NAMES[baan]}
                </td>
                {Array.from({ length: TOTAL_WAVES }, (_, i) => {
                  const wave = i + 1
                  const cell = matrix[wave]?.[baan]
                  const areas = cell?.areas ?? []
                  const disasterAreas = cell?.disasterAreas ?? []
                  return (
                    <td key={wave} className="min-w-28 px-3 py-2 text-slate-700">
                      {wave > maxVisibleWave ? '-' : areas.length || disasterAreas.length ? (
                        <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
                          {areas.length > 0 && <span>{areas.join(', ')}</span>}
                          {disasterAreas.length > 0 && (
                            <span className="ownership-disaster-areas">
                              {disasterAreas.join(', ')}
                            </span>
                          )}
                        </span>
                      ) : '-'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
