'use client'
import clsx from 'clsx'
import { HOUSE_COLORS, HOUSE_NAMES, ScoreEntry } from '@/lib/constants'
import { Trophy, Medal, Award } from 'lucide-react'

interface ScoreboardProps {
  entries:      ScoreEntry[]
  title?:       string
  wave?:        number
  showRewards?: boolean
  compact?:     boolean
  highlight?:   number
}

export default function Scoreboard({
  entries, title, wave, showRewards, compact, highlight,
}: ScoreboardProps) {
  // เรียงคะแนนจากมากไปน้อย
  const sorted = [...entries].sort((a, b) => b.score - a.score)

  return (
    <div className="space-y-3 w-full">
      {/* Header */}
      {(title || wave !== undefined) && (
        <div className="flex items-center justify-between mb-2">
          {title && <h3 className="font-display font-bold text-lg text-white drop-shadow-md">{title}</h3>}
          {wave !== undefined && (
            <span className="badge bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-full text-xs font-bold tracking-wider animate-pulse">
              WAVE {wave}
            </span>
          )}
        </div>
      )}

      {/* Entries (Kahoot Style) */}
      <div className="flex flex-col gap-2">
        {sorted.map((entry, idx) => {
          const rank      = idx + 1
          const color     = HOUSE_COLORS[entry.baan] || '#ffffff'
          const isTop1    = rank === 1
          const isTop3    = rank <= 3
          const isHighlit = highlight === entry.baan

          return (
            <div
              key={entry.baan}
              className={clsx(
                'relative flex items-center gap-3 rounded-xl border p-3 transition-all duration-300',
                isHighlit ? 'scale-105 z-10 ring-2 ring-white' : 'hover:scale-[1.02]',
                isTop1 ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/10 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)]' :
                isTop3 ? 'bg-white/10 border-white/20' :
                'bg-white/5 border-white/5 opacity-80 hover:opacity-100'
              )}
            >
              {/* Rank Icon */}
              <div className="flex items-center justify-center w-8 flex-shrink-0">
                {isTop1 ? <Trophy size={24} className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" /> :
                 rank === 2 ? <Medal size={22} className="text-slate-300" /> :
                 rank === 3 ? <Award size={22} className="text-amber-600" /> :
                 <span className="font-display font-bold text-slate-500 text-lg">#{rank}</span>}
              </div>

              {/* Color Bar */}
              <div className="w-2 h-full absolute left-0 top-0 bottom-0 rounded-l-xl opacity-80" style={{ backgroundColor: color }} />

              {/* House Name */}
              <div className="flex-1 min-w-0 pl-2">
                <div className={clsx(
                  'font-display font-bold tracking-wide truncate',
                  isTop1 ? 'text-xl text-yellow-100' : 'text-lg text-slate-100'
                )}>
                  {HOUSE_NAMES[entry.baan]}
                </div>
                {entry.extra && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {Object.entries(entry.extra).map(([k, v]) => (
                      <span key={k} className="text-xs bg-black/30 rounded px-2 py-0.5 text-slate-300">
                        {k}: <span className="text-white font-semibold">{v}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Score Display (Right) */}
              <div className="text-right flex-shrink-0">
                <div className={clsx(
                  'font-mono font-black',
                  isTop1 ? 'text-2xl text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]' :
                  isTop3 ? 'text-xl text-white' : 'text-lg text-slate-300'
                )}>
                  {entry.score.toLocaleString()}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {sorted.length === 0 && (
        <div className="py-10 text-center border border-dashed border-white/10 rounded-xl bg-white/5">
          <p className="text-slate-500 font-display">No scores available yet</p>
        </div>
      )}
    </div>
  )
}