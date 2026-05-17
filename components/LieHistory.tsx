'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { HOUSE_COLORS, HOUSE_NAMES } from '@/lib/constants'
import { fetchLieHistoryWave, type LieHistoryCell } from '@/lib/sheets'

const LIE_WAVES = [1, 2, 3, 4]

type LieMatrix = Record<number, Record<number, LieHistoryCell>>

function PromiseTokens({ promises, actual }: { promises: string[]; actual: string[] }) {
  const actualSet = new Set(actual)
  if (!promises.length) return <span className="text-slate-400">-</span>

  return (
    <span className="lie-token-row">
      {promises.map(area => {
        const honest = actualSet.has(area)
        return (
          <span key={area} className={clsx('lie-token', honest ? 'lie-token-honest' : 'lie-token-lie')}>
            {area}
          </span>
        )
      })}
    </span>
  )
}

export default function LieHistory({ className }: { className?: string }) {
  const [matrix, setMatrix] = useState<LieMatrix>({})

  const refreshAll = useCallback(async () => {
    try {
      const next: LieMatrix = {}
      await Promise.all(LIE_WAVES.map(async wave => {
        const rows = await fetchLieHistoryWave(wave)
        next[wave] = {}
        rows.forEach(row => { next[wave][row.baan] = row })
      }))
      setMatrix(next)
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    refreshAll()
    const intervalId = window.setInterval(refreshAll, 20000)
    return () => window.clearInterval(intervalId)
  }, [refreshAll])

  return (
    <div className={clsx('lie-history wire-panel bg-white p-4', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="font-display text-sm font-bold text-slate-800">Lie History</div>
        <button onClick={refreshAll} className="btn btn-ghost py-1.5 px-2 text-xs">Refresh</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th rowSpan={2} className="px-3 py-2 text-left align-middle">House</th>
              {LIE_WAVES.map(wave => (
                <th key={wave} colSpan={2} className="min-w-56 border-l border-slate-200 px-3 py-2 text-center">
                  Wave {wave}
                </th>
              ))}
            </tr>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              {LIE_WAVES.map(wave => (
                <Fragment key={wave}>
                  <th className="min-w-32 border-l border-slate-200 px-3 py-1.5 text-left text-[0.66rem] uppercase tracking-[0.08em] text-slate-500">Promises</th>
                  <th className="min-w-32 px-3 py-1.5 text-left text-[0.66rem] uppercase tracking-[0.08em] text-slate-500">Actual</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(baan => (
              <tr key={baan} className="border-b border-slate-100">
                <td className="whitespace-nowrap px-3 py-2 font-semibold" style={{ color: HOUSE_COLORS[baan] }}>
                  {HOUSE_NAMES[baan]}
                </td>
                {LIE_WAVES.map(wave => {
                  const cell = matrix[wave]?.[baan]
                  const promises = cell?.promises ?? []
                  const actual = cell?.actual ?? []
                  return (
                    <Fragment key={wave}>
                      <td className="border-l border-slate-100 px-3 py-2 align-top text-slate-700">
                        <PromiseTokens promises={promises} actual={actual} />
                      </td>
                      <td className="px-3 py-2 align-top text-slate-700">
                        <div className="lie-actual-text">{actual.length ? actual.join(', ') : '-'}</div>
                      </td>
                    </Fragment>
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
